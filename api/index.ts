import { createApp } from '../server/app.ts'
import { loadDotEnv, loadEnv } from '../server/config/env.ts'

loadDotEnv()

const env = loadEnv({
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? 'production',
})

export default createApp(env)
