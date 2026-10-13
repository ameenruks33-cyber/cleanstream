# MyTube

A distraction-free video app for the browser, with an optional Windows desktop build.

CleanStream includes **Ad Shield** for third-party ads and trackers in the app itself. It does **not** block, skip, or rewrite advertisements inside YouTube’s official player, scrape streams, extract audio, or offer downloads. Licensed CleanStream titles play in a separate HTML5 player with no ad SDK.

## Tailored version (this folder)

This project lives only at `E:\youtube add free`.

| Choice | Decision |
| --- | --- |
| Where it runs | Website first (`http://localhost:5173`), then optional Electron installer for Windows |
| Videos | Both YouTube (official API + embed) and licensed CleanStream files |
| Budget | Free local tools and free-tier accounts where they exist. Hosting, YouTube quota, and Supabase may later cost money. |

## Folder structure

```
src/                  React UI, library logic, tests
  app/                Providers, router, shell (Ad Shield provider)
  components/         Shared UI
  features/           Home, search, player, playlists, history, favorites, settings, Ad Shield
  lib/adshield/       App-level filter engine, domain validation, local storage
  lib/                Validation, library reducers, auth helper
  services/           API client, optional Supabase
  tests/              Frontend tests
server/               Express API (YouTube proxy, library, security)
  routes/ middleware/ services/ config/ tests/
supabase/migrations/  Optional RLS-backed library table
electron/             Windows desktop wrapper + session.webRequest Ad Shield adapter
media/                Authorized uploads and enhanced outputs (gitignored)
public/               Favicon and caption files
```

## Setup

```powershell
cd "E:\youtube add free"
copy .env.example .env
npm install
npm run dev
```

- App: [http://localhost:5173](http://localhost:5173)
- API: [http://127.0.0.1:8787/api/health](http://127.0.0.1:8787/api/health)

Without a YouTube API key, search still returns watchable videos and plays them in the official YouTube player. An optional API key uses Google’s Data API instead.

## Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | Server only | YouTube Data API v3 |
| `PORT` | Server | API port (default `8787`) |
| `APP_URL` | Server | Allowed CORS origin |
| `SUPABASE_URL` | Server / docs | Optional auth project |
| `SUPABASE_ANON_KEY` | Server / docs | Public anon key (RLS required) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Never expose this. Not used by the UI. |
| `VITE_SUPABASE_URL` | Frontend | Same URL as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Same value as `SUPABASE_ANON_KEY` |

Do not prefix the YouTube key or the service-role key with `VITE_`.

## YouTube Data API v3

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project.
3. Enable **YouTube Data API v3**.
4. Create an API key.
5. Restrict the key to that API, and to your server IPs or referrers when you go live.
6. Put the key in `.env` as `YOUTUBE_API_KEY`.
7. Restart `npm run dev`.

Official docs: [YouTube Data API](https://developers.google.com/youtube/v3). Policies: [YouTube API Services](https://developers.google.com/youtube/terms/developer-policies).

Search uses quota. This app caches successful API responses in memory for ten minutes and surfaces quota errors instead of retrying blindly.

## Optional Supabase

1. Create a project at [supabase.com](https://supabase.com/).
2. Run `supabase/migrations/001_init.sql` in the SQL editor.
3. Copy the project URL and **anon** key into `.env` (`SUPABASE_*` and `VITE_SUPABASE_*`).
4. Leave the service-role key on the server, unused by the browser.
5. Enable email auth. Magic-link sign-in syncs favorites, playlists, and history.

Guest mode works with no Supabase account; data stays in `localStorage`.

## Ad Shield

Open **Ad Shield** in the sidebar or Settings.

| Context | What happens |
| --- | --- |
| CleanStream UI | Third-party ad networks and optional trackers can be blocked. Count is a local estimate. |
| Licensed library videos | HTML5 player, no advertising SDK. |
| YouTube embed | Official player is unchanged. YouTube may still show its ads. |
| Chrome / website | Filters requests made by CleanStream. It cannot control all browser traffic. |
| Windows desktop (Electron) | `session.webRequest` applies host rules, except YouTube player origins. |

Preferences are stored in `localStorage` (`cleanstream.adshield.v1`). No filtering telemetry is sent.

Optional EasyList-style host updates are HTTPS-only, size-capped, and ignored on failure. Element-hiding rules and YouTube origins are never applied.

No extra advertising or ad-blocker npm packages are installed. Electron 41 uses its supported `webRequest` API with context isolation, sandboxing, and `nodeIntegration: false`.

## Tests

```powershell
npm test
```

External YouTube calls are mocked. Rate-limit tests use a temporary in-memory Express app.

## Production web build

```powershell
npm run build
$env:NODE_ENV="production"
npx tsx server/index.ts
```

The API then serves `dist/` on `http://127.0.0.1:8787`. Put `YOUTUBE_API_KEY` in the server environment. Put a restrictive Content Security Policy in front if you use another host.

## Windows packaging

```powershell
npm run electron:dev
```

Run this while `npm run dev` is already serving the web app.

Installer (unsigned):

```powershell
npm run electron:build
```

The NSIS installer is written to `release/`. Code signing needs a purchased certificate; this repo does not ship one. After install, place a `.env` with `YOUTUBE_API_KEY` in the app user-data folder if you want live YouTube search.

## Background 4K enhancement (authorized files only)

Hybrid pipeline: play the original immediately, then Lanczos-scale eligible CleanStream files toward 3840×2160 in a single background worker. If `ENHANCE_AI_BIN` points at a Real-ESRGAN binary, an optional second pass runs after fast scaling. This creates a 4K-sized file; it does **not** recover genuine 4K camera detail.

YouTube titles stay in the official embed. CleanStream does not download, extract, or upscale YouTube audiovisual streams.

Install [FFmpeg](https://ffmpeg.org/) on your PATH, then open a library title. Status appears under the HTML5 player. Compare original vs enhanced when the job finishes.

```powershell
winget install Gyan.FFmpeg
```

Uploads: Library → authorized MP4 (local-only, 80 MB). Files are stored under `media/input/`.

## Known limitations and policy notes

- Ad Shield is **not** 100% YouTube ad blocking. YouTube ads can still appear in the official player. CleanStream does not overlay, skip, intercept, or replace them.
- Ad-free YouTube, where eligible, is [YouTube Premium](https://www.youtube.com/premium).
- In a normal browser, Ad Shield cannot see every network request the browser makes—only CleanStream’s own requests. The desktop app can filter more, still excluding the YouTube player.
- Embedding can be disabled by the uploader; we then link to YouTube instead of forcing playback.
- API quota, Vercel/hosting, object storage, and Supabase may cost money in production.
- Desktop builds are unsigned unless you add your own certificate.
- Sample library titles are Blender Foundation open movies served from Google’s public HTML5 sample bucket, not extracted YouTube streams.
- 4K enhancement is background upscaling of authorized files. It is not real-time on most PCs and is not native 4K restoration. YouTube videos are never sent through this pipeline.

## GitHub and Vercel

Opening the production URL installs CleanStream as an app on supported browsers (Chrome, Edge, Android). iPhone/iPad: Share → Add to Home Screen. Safari cannot auto-install.

```powershell
npm run build
npx vercel --prod --yes --scope ameenruks33-cybers-projects
```
