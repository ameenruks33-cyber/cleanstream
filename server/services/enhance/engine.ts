import { spawn, type ChildProcess } from 'node:child_process'
import { createWriteStream, existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { basename, resolve } from 'node:path'
import { FILE_ID_RE, INPUT_DIR, OUTPUT_DIR, ensureMediaDirs, safeMediaFile } from './paths.ts'
import { resolveAuthorizedSource, type AuthorizedSource } from './sources.ts'

export type QualityReport = {
  width?: number
  height?: number
  fps?: number
  codec?: string
  bitrate?: number
  durationSeconds?: number
  format?: string
}

export type EnhanceJob = {
  jobId: string
  fileId: string
  status: 'queued' | 'running' | 'ready' | 'failed' | 'skipped'
  stage: 'probe' | 'lanczos' | 'ai' | 'done'
  progress: number
  message: string
  source?: QualityReport
  outputId?: string
  encoder?: string
  ai: { available: boolean; status: 'skipped' | 'queued' | 'running' | 'ready' | 'failed'; note: string }
  createdAt: string
  updatedAt: string
}

export type BinaryStatus = {
  ffmpeg: boolean
  ffprobe: boolean
  ai: boolean
  encoder: string
  maxConcurrentJobs: number
}

const MAX_JOBS = 1
const MAX_DURATION_SECONDS = 40 * 60
const jobs = new Map<string, EnhanceJob>()
const byFile = new Map<string, string>()
const queue: string[] = []
let active = 0
let encoderCache: string | null = null
let children = new Map<string, ChildProcess>()

type ProbeFn = (input: string) => Promise<QualityReport>
type RunFn = (command: string, args: string[], onProgress?: (ratio: number) => void) => Promise<number>
type BinFn = () => BinaryStatus

let probeImpl: ProbeFn = probeWithFfprobe
let runImpl: RunFn = runProcess
let binsImpl: BinFn = detectBinaries

export function configureEnhanceEngine(overrides: { probe?: ProbeFn; run?: RunFn; binaries?: BinFn }): void {
  if (overrides.probe) probeImpl = overrides.probe
  if (overrides.run) runImpl = overrides.run
  if (overrides.binaries) binsImpl = overrides.binaries
}

export function resetEnhanceEngine(): void {
  for (const child of children.values()) child.kill('SIGKILL')
  children.clear()
  jobs.clear()
  byFile.clear()
  queue.length = 0
  active = 0
  encoderCache = null
  probeImpl = probeWithFfprobe
  runImpl = runProcess
  binsImpl = detectBinaries
}

function nowIso(): string {
  return new Date().toISOString()
}

function patchJob(jobId: string, patch: Partial<EnhanceJob>): EnhanceJob {
  const current = jobs.get(jobId)
  if (!current) throw new Error('Unknown job')
  const next = { ...current, ...patch, updatedAt: nowIso() }
  jobs.set(jobId, next)
  return next
}

export function detectBinaries(): BinaryStatus {
  const ffmpeg = commandOnPath('ffmpeg')
  const ffprobe = commandOnPath('ffprobe')
  return {
    ffmpeg,
    ffprobe,
    ai: Boolean(resolveAiBinary()),
    encoder: encoderCache ?? (ffmpeg ? 'libx264' : 'none'),
    maxConcurrentJobs: MAX_JOBS,
  }
}

function existsOnPath(fileName: 'ffmpeg' | 'ffmpeg.exe' | 'ffprobe' | 'ffprobe.exe' | 'realesrgan-ncnn-vulkan' | 'realesrgan-ncnn-vulkan.exe'): boolean {
  const paths = (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':')
  for (const dir of paths) {
    if (!dir || dir.includes('..')) continue
    if (fileName === 'ffmpeg' && existsSync(resolve(dir, 'ffmpeg'))) return true
    if (fileName === 'ffmpeg.exe' && existsSync(resolve(dir, 'ffmpeg.exe'))) return true
    if (fileName === 'ffprobe' && existsSync(resolve(dir, 'ffprobe'))) return true
    if (fileName === 'ffprobe.exe' && existsSync(resolve(dir, 'ffprobe.exe'))) return true
    if (fileName === 'realesrgan-ncnn-vulkan' && existsSync(resolve(dir, 'realesrgan-ncnn-vulkan'))) return true
    if (fileName === 'realesrgan-ncnn-vulkan.exe' && existsSync(resolve(dir, 'realesrgan-ncnn-vulkan.exe'))) return true
  }
  return false
}

function commandOnPath(name: 'ffmpeg' | 'ffprobe' | 'realesrgan-ncnn-vulkan'): boolean {
  if (name === 'ffmpeg') return existsOnPath('ffmpeg') || existsOnPath('ffmpeg.exe')
  if (name === 'ffprobe') return existsOnPath('ffprobe') || existsOnPath('ffprobe.exe')
  return existsOnPath('realesrgan-ncnn-vulkan') || existsOnPath('realesrgan-ncnn-vulkan.exe')
}

function resolveAiBinary(): string | null {
  const configured = process.env.ENHANCE_AI_BIN?.trim()
  if (configured) {
    const base = basename(configured).toLowerCase()
    if (!/^(realesrgan-ncnn-vulkan)(\.exe)?$/.test(base)) return null
    if (!existsSync(configured)) return null
    return configured
  }
  if (commandOnPath('realesrgan-ncnn-vulkan')) return 'realesrgan-ncnn-vulkan'
  return null
}

async function probeWithFfprobe(input: string): Promise<QualityReport> {
  const args = ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input]
  const { stdout } = await collectFfprobe(args)
  const json = JSON.parse(stdout) as {
    format?: { bit_rate?: string; duration?: string; format_name?: string }
    streams?: Array<{
      codec_type?: string
      codec_name?: string
      width?: number
      height?: number
      r_frame_rate?: string
    }>
  }
  const video = json.streams?.find((stream) => stream.codec_type === 'video')
  const fpsParts = video?.r_frame_rate?.split('/') ?? []
  const fps =
    fpsParts.length === 2 && Number(fpsParts[1]) > 0 ? Number(fpsParts[0]) / Number(fpsParts[1]) : undefined
  return {
    width: video?.width,
    height: video?.height,
    fps: fps && Number.isFinite(fps) ? Math.round(fps * 100) / 100 : undefined,
    codec: video?.codec_name,
    bitrate: json.format?.bit_rate ? Number(json.format.bit_rate) : undefined,
    durationSeconds: json.format?.duration ? Number(json.format.duration) : undefined,
    format: json.format?.format_name,
  }
}

function spawnTracked(
  child: ChildProcess,
  onProgress?: (ratio: number) => void,
): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const id = randomUUID()
    children.set(id, child)
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      const match = text.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/)
      if (match && onProgress) {
        const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
        onProgress(seconds)
      }
    })
    child.on('error', (error) => {
      children.delete(id)
      reject(error)
    })
    child.on('close', (code) => {
      children.delete(id)
      resolvePromise(code ?? 1)
    })
  })
}

function collectFfprobe(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('ffprobe', args, { shell: false, windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => resolvePromise({ code: code ?? 1, stdout, stderr }))
  })
}

function collectFfmpegEncoders(): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-encoders'], { shell: false, windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', () => resolvePromise({ stdout, stderr }))
  })
}

async function runFfmpeg(args: string[], onProgress?: (ratio: number) => void): Promise<number> {
  const child = spawn('ffmpeg', args, { shell: false, windowsHide: true })
  return spawnTracked(child, onProgress)
}

async function runOptionalAi(args: string[], onProgress?: (ratio: number) => void): Promise<number> {
  const ai = resolveAiBinary()
  if (!ai) throw new Error('AI binary is not available.')
  const child = spawn(ai, args, { shell: false, windowsHide: true })
  return spawnTracked(child, onProgress)
}

async function runProcess(command: string, args: string[], onProgress?: (ratio: number) => void): Promise<number> {
  if (command === 'ffmpeg') return runFfmpeg(args, onProgress)
  if (command === 'ffprobe') {
    const result = await collectFfprobe(args)
    return result.code
  }
  if (command === resolveAiBinary()) return runOptionalAi(args, onProgress)
  throw new Error('Command is not permitted.')
}

async function pickEncoder(): Promise<string> {
  if (encoderCache) return encoderCache
  if (!commandOnPath('ffmpeg')) {
    encoderCache = 'none'
    return encoderCache
  }
  try {
    const { stdout, stderr } = await collectFfmpegEncoders()
    const listing = `${stdout}\n${stderr}`
    if (listing.includes('h264_nvenc')) encoderCache = 'h264_nvenc'
    else if (listing.includes('h264_qsv')) encoderCache = 'h264_qsv'
    else if (listing.includes('h264_amf')) encoderCache = 'h264_amf'
    else encoderCache = 'libx264'
  } catch {
    encoderCache = 'libx264'
  }
  return encoderCache
}

function encoderArgs(encoder: string): string[] {
  if (encoder === 'h264_nvenc') return ['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '23']
  if (encoder === 'h264_qsv') return ['-c:v', 'h264_qsv', '-preset', 'veryfast', '-global_quality', '23']
  if (encoder === 'h264_amf') return ['-c:v', 'h264_amf', '-quality', 'speed']
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20']
}

export async function inspectQuality(fileId: string): Promise<{
  enhanceable: boolean
  reason: string
  source?: QualityReport
  binaries: BinaryStatus
  title?: string
}> {
  const binaries = binsImpl()
  const authorized = resolveAuthorizedSource(fileId)
  if (!authorized) {
    return { enhanceable: false, reason: 'Not an authorized MyTube file.', binaries }
  }
  if (!binaries.ffprobe || !binaries.ffmpeg) {
    return {
      enhanceable: false,
      reason: 'FFmpeg is not installed. Original playback still works. Install FFmpeg to enable background 4K scaling.',
      binaries,
      title: authorized.title,
    }
  }
  const source = await probeImpl(authorized.input)
  if ((source.durationSeconds ?? 0) > MAX_DURATION_SECONDS) {
    return {
      enhanceable: false,
      reason: 'This file is longer than the 40-minute enhancement limit.',
      source,
      binaries,
      title: authorized.title,
    }
  }
  if ((source.width ?? 0) >= 3840 && (source.height ?? 0) >= 2160) {
    return {
      enhanceable: false,
      reason: 'Source is already 4K or larger. Playing the original.',
      source,
      binaries,
      title: authorized.title,
    }
  }
  return {
    enhanceable: true,
    reason: 'Eligible for background Lanczos upscaling to 3840×2160. This enlarges the frame; it does not recover camera detail that was never captured.',
    source,
    binaries,
    title: authorized.title,
  }
}

export function youtubeQualityNotice(videoId: string): {
  enhanceable: false
  player: 'official-embed'
  videoId: string
  reason: string
} {
  return {
    enhanceable: false,
    player: 'official-embed',
    videoId,
    reason:
      'YouTube videos play in the official embed. MyTube does not extract, download, or upscale YouTube streams. Use the player’s own quality menu, or YouTube Premium where eligible.',
  }
}

export function getJob(jobId: string): EnhanceJob | undefined {
  return jobs.get(jobId)
}

export function getJobForFile(fileId: string): EnhanceJob | undefined {
  const id = byFile.get(fileId)
  return id ? jobs.get(id) : undefined
}

export function queueEnhance(fileId: string): EnhanceJob {
  ensureMediaDirs()
  const existing = getJobForFile(fileId)
  if (existing && (existing.status === 'queued' || existing.status === 'running' || existing.status === 'ready')) {
    return existing
  }
  const cached = readCachedOutput(fileId)
  if (cached) {
    const jobId = randomUUID()
    const job: EnhanceJob = {
      jobId,
      fileId,
      status: 'ready',
      stage: 'done',
      progress: 100,
      outputId: cached,
      message: 'Using a cached 4K-sized copy.',
      ai: { available: Boolean(resolveAiBinary()), status: 'skipped', note: 'Cached output reused.' },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    jobs.set(jobId, job)
    byFile.set(fileId, jobId)
    return job
  }
  if (!resolveAuthorizedSource(fileId)) {
    throw Object.assign(new Error('Authorized source file not found.'), { status: 404, code: 'NOT_FOUND' })
  }
  const jobId = randomUUID()
  const aiBin = resolveAiBinary()
  const job: EnhanceJob = {
    jobId,
    fileId,
    status: 'queued',
    stage: 'probe',
    progress: 0,
    message: 'Queued behind the player. Original playback can start now.',
    ai: {
      available: Boolean(aiBin),
      status: aiBin ? 'queued' : 'skipped',
      note: aiBin
        ? 'AI enhancement will run after fast scaling if the optional GPU binary is present.'
        : 'No AI binary found. Fast FFmpeg Lanczos scaling will be used. Set ENHANCE_AI_BIN to enable a second pass.',
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  jobs.set(jobId, job)
  byFile.set(fileId, jobId)
  queue.push(jobId)
  void pump()
  return job
}

async function pump(): Promise<void> {
  if (active >= MAX_JOBS) return
  const jobId = queue.shift()
  if (!jobId) return
  active += 1
  try {
    await runJob(jobId)
  } finally {
    active -= 1
    void pump()
  }
}

async function runJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId)
  if (!job) return
  const source = resolveAuthorizedSource(job.fileId)
  if (!source) {
    patchJob(jobId, { status: 'failed', message: 'Authorized source file not found.' })
    return
  }
  const binaries = binsImpl()
  if (!binaries.ffmpeg || !binaries.ffprobe) {
    patchJob(jobId, {
      status: 'failed',
      message: 'FFmpeg is not installed on this computer.',
    })
    return
  }
  patchJob(jobId, { status: 'running', stage: 'probe', progress: 2, message: 'Analyzing source quality…' })
  let report: QualityReport
  try {
    report = await probeImpl(source.input)
  } catch {
    patchJob(jobId, { status: 'failed', message: 'Could not read this authorized file.' })
    return
  }
  if ((report.width ?? 0) >= 3840 && (report.height ?? 0) >= 2160) {
    patchJob(jobId, {
      status: 'skipped',
      stage: 'done',
      progress: 100,
      source: report,
      message: 'Already 4K. Playing the original.',
    })
    return
  }
  const encoder = await pickEncoder()
  const outputId = randomUUID()
  const output = safeMediaFile(OUTPUT_DIR, outputId, '.mp4')
  patchJob(jobId, {
    status: 'running',
    stage: 'lanczos',
    progress: 5,
    source: report,
    encoder,
    message: `Scaling toward 3840×2160 with Lanczos (${encoder}). This is not genuine 4K detail.`,
  })
  const args = [
    '-nostdin',
    '-hide_banner',
    '-y',
    '-i',
    source.input,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-vf',
    'scale=3840:2160:force_original_aspect_ratio=decrease:flags=lanczos,pad=3840:2160:(ow-iw)/2:(oh-ih)/2',
    ...encoderArgs(encoder),
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    output,
  ]
  const duration = report.durationSeconds ?? 0
  try {
    const code = await runImpl('ffmpeg', args, (seconds) => {
      if (duration > 0) {
        const ratio = Math.min(0.9, Math.max(0.05, seconds / duration))
        patchJob(jobId, { progress: Math.round(ratio * 100), status: 'running', stage: 'lanczos' })
      }
    })
    if (code !== 0 || !existsSync(output)) {
      if (existsSync(output)) unlinkSync(output)
      patchJob(jobId, { status: 'failed', message: 'FFmpeg scaling failed.' })
      return
    }
  } catch (error) {
    if (existsSync(output)) unlinkSync(output)
    patchJob(jobId, {
      status: 'failed',
      message: error instanceof Error ? error.message : 'FFmpeg failed to start.',
    })
    return
  }

  const aiBin = resolveAiBinary()
  if (aiBin) {
    patchJob(jobId, {
      stage: 'ai',
      progress: 92,
      ai: {
        available: true,
        status: 'running',
        note: 'Optional AI pass started after fast scaling.',
      },
      message: 'Running optional AI enhancement. Lanczos copy is kept if this fails.',
    })
    const aiOut = safeMediaFile(OUTPUT_DIR, `${outputId}-ai`, '.mp4')
    try {
      const code = await runImpl(aiBin, ['-i', output, '-o', aiOut])
      if (code === 0 && existsSync(aiOut)) {
        patchJob(jobId, {
          status: 'ready',
          stage: 'done',
          progress: 100,
          outputId: `${outputId}-ai`,
          ai: { available: true, status: 'ready', note: 'AI pass completed. Compare with the original anytime.' },
          message: 'Enhanced copy ready. Original is still available for comparison.',
        })
        writeCache(job.fileId, `${outputId}-ai`)
        return
      }
    } catch {
      /* keep lanczos output */
    }
    patchJob(jobId, {
      ai: { available: true, status: 'failed', note: 'AI pass failed; Lanczos 4K-sized copy is ready.' },
    })
  }

  writeCache(job.fileId, outputId)
  patchJob(jobId, {
    status: 'ready',
    stage: 'done',
    progress: 100,
    outputId,
    message: '4K-sized copy ready. This is upscaled output, not recovered native 4K detail.',
    ai: {
      available: Boolean(aiBin),
      status: 'skipped',
      note: aiBin ? 'AI pass was skipped after a failure.' : 'AI binary not installed.',
    },
  })
}

function writeCache(fileId: string, outputId: string): void {
  const cache = safeMediaFile(OUTPUT_DIR, 'cache', '.json')
  let data: Record<string, string> = {}
  if (existsSync(cache)) {
    try {
      data = JSON.parse(readFileSync(cache, 'utf8')) as Record<string, string>
    } catch {
      data = {}
    }
  }
  data[fileId] = outputId
  writeFileSync(cache, JSON.stringify(data), 'utf8')
}

export function readCachedOutput(fileId: string): string | undefined {
  const cache = resolve(OUTPUT_DIR, 'cache.json')
  if (!existsSync(cache)) return undefined
  try {
    const data = JSON.parse(readFileSync(cache, 'utf8')) as Record<string, string>
    const outputId = data[fileId]
    if (!outputId) return undefined
    const file = safeMediaFile(OUTPUT_DIR, outputId, '.mp4')
    return existsSync(file) ? outputId : undefined
  } catch {
    return undefined
  }
}

export function saveUpload(fileId: string, stream: NodeJS.ReadableStream, maxBytes: number): Promise<string> {
  ensureMediaDirs()
  if (!FILE_ID_RE.test(fileId)) {
    return Promise.reject(Object.assign(new Error('Invalid file id.'), { status: 400, code: 'INVALID_VIDEO_ID' }))
  }
  const dest = safeMediaFile(INPUT_DIR, fileId, '.mp4')
  return new Promise((resolvePromise, reject) => {
    const out = createWriteStream(dest)
    let size = 0
    stream.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) {
        stream.destroy()
        out.destroy()
        if (existsSync(dest)) unlinkSync(dest)
        reject(Object.assign(new Error('File is larger than 80 MB.'), { status: 413, code: 'TOO_LARGE' }))
      }
    })
    stream.on('error', reject)
    out.on('error', reject)
    out.on('finish', () => resolvePromise(dest))
    stream.pipe(out)
  })
}

export { commandOnPath }
