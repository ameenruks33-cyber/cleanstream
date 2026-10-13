import { createApp } from './app.ts'
import { loadDotEnv, loadEnv, logSafe } from './config/env.ts'
import { startMovieRefreshLoop } from './services/movies/jobs.ts'

loadDotEnv()
const env = loadEnv()
const app = createApp(env)
startMovieRefreshLoop(env)

const server = app.listen(env.PORT, '127.0.0.1', () => {
  logSafe('cleanstream_api_started', { port: env.PORT, env: env.NODE_ENV })
})

server.requestTimeout = 15_000
server.headersTimeout = 16_000
