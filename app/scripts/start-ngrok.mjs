import fs from 'node:fs'
import path from 'node:path'
import ngrok from '@ngrok/ngrok'

const workspace = path.resolve(process.cwd(), '..')
const statusPath = path.join(workspace, 'work', 'ngrok-status.json')
const configPath = path.join(process.env.LOCALAPPDATA ?? '', 'ngrok', 'ngrok.yml')

fs.mkdirSync(path.dirname(statusPath), { recursive: true })

try {
  const config = fs.readFileSync(configPath, 'utf8')
  const tokenMatch = config.match(/^\s*authtoken:\s*["']?([^\s"']+)/m)
  if (!tokenMatch?.[1]) throw new Error('ngrok authtoken was not found in the configured ngrok.yml')
  const listener = await ngrok.forward({
    addr: 'http://127.0.0.1:5173',
    authtoken: tokenMatch[1],
    compression: true,
  })
  const status = { url: listener.url(), pid: process.pid, startedAt: new Date().toISOString() }
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2))
  process.stdin.resume()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  fs.writeFileSync(statusPath, JSON.stringify({ error: message, pid: process.pid }, null, 2))
  process.exitCode = 1
}
