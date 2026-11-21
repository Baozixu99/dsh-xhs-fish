import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { McpEngine } from './mcp-engine.js'
import { MockEngine } from './mock-engine.js'

export class EngineManager {
  constructor({ dataDir, pluginDir, getConfig, logger = console }) {
    this.dataDir = dataDir
    this.pluginDir = pluginDir
    this.getConfig = getConfig
    this.logger = logger
    this.engine = null
    this.signature = ''
  }

  async get() {
    const cfg = this.getConfig()
    const binary = cfg.engineBinary || join(
      this.pluginDir,
      'bin',
      process.platform === 'win32' ? 'xiaohongshu-mcp.exe' : 'xiaohongshu-mcp',
    )
    const signature = `${cfg.engine}|${cfg.enginePort}|${binary}|${cfg.autoStartEngine}|${cfg.engineHome}|${cfg.cookiesPath}`
    if (this.engine && signature === this.signature) return this.engine
    if (this.engine) await this.engine.close().catch(() => {})
    this.signature = signature
    const env = buildEngineEnv(cfg)
    this.engine = cfg.engine === 'mcp'
      ? new McpEngine({ dataDir: this.dataDir, binary, port: cfg.enginePort, autoStart: cfg.autoStartEngine, env, logger: this.logger })
      : new MockEngine()
    return this.engine
  }

  async close() {
    const engine = this.engine
    this.engine = null
    this.signature = ''
    if (engine) await engine.close().catch(() => {})
  }
}

function buildEngineEnv(cfg) {
  const env = {}
  if (cfg.engineHome) {
    const home = resolve(cfg.engineHome)
    env.USERPROFILE = home
    env.LOCALAPPDATA = join(home, 'AppData', 'Local')
    env.APPDATA = join(home, 'AppData', 'Roaming')
    env.TEMP = join(home, 'tmp')
    env.TMP = env.TEMP
    env.TMPDIR = env.TEMP
    for (const dir of [env.LOCALAPPDATA, env.APPDATA, env.TEMP]) {
      try { mkdirSync(dir, { recursive: true }) } catch { /* 引擎启动时会给出明确错误 */ }
    }
  }
  if (cfg.cookiesPath) env.COOKIES_PATH = resolve(cfg.cookiesPath)
  return env
}
