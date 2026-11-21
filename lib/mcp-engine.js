import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

export class EngineError extends Error {
  constructor(code, message, details = null) {
    super(message)
    this.name = 'EngineError'
    this.code = code
    this.details = details
  }
}

/**
 * xiaohongshu-mcp sidecar 的 HTTP MCP 适配器。
 *
 * 事实来源（2026-11-04）：
 * - 项目：https://github.com/xpzouying/xiaohongshu-mcp
 * - MCP 地址：http://localhost:18060/mcp
 * - 工具名：check_login_status / get_login_qrcode / search_feeds /
 *   get_feed_detail / publish_content / post_comment_to_feed / reply_comment_in_feed
 *
 * 未在真实 DSH 运行时验证；Phase 0 必须先跑通 initialize + tools/call。
 */
export class McpEngine {
  constructor({ dataDir, binary, port = 18060, autoStart = true, env = null, startTimeoutMs = 180_000, requestTimeoutMs = 120_000, logger = console } = {}) {
    this.dataDir = dataDir
    this.binary = String(binary || '').trim()
    this.port = Number(port) || 18060
    this.autoStart = autoStart !== false
    this.env = env && typeof env === 'object' ? { ...env } : {}
    this.startTimeoutMs = Math.max(15_000, Number(startTimeoutMs) || 180_000)
    this.requestTimeoutMs = Math.max(5_000, Number(requestTimeoutMs) || 120_000)
    this.url = `http://127.0.0.1:${this.port}/mcp`
    this.logger = logger
    this.child = null
    this.starting = null
    this.startError = null
    this.startFailed = null
    this.sessionId = ''
    this.protocolVersion = ''
    this.initialized = false
    this.nextId = 1
    this.logFile = join(dataDir, 'engine.log')
    mkdirSync(dataDir, { recursive: true })
  }

  async health() {
    if ((!this.child || this.child.exitCode !== null) && this.startFailed) {
      return { ok: false, engine: 'mcp', endpoint: this.url, error: publicError(this.startFailed)?.message || String(this.startFailed) }
    }
    if ((!this.child || this.child.exitCode !== null) && this.autoStart) {
      try {
        await this.ensureStarted()
      } catch (error) {
        return { ok: false, engine: 'mcp', endpoint: this.url, error: publicError(error)?.message || String(error) }
      }
    }
    if (!this.child || this.child.exitCode !== null) {
      return { ok: false, engine: 'mcp', endpoint: this.url, error: 'sidecar 未启动' }
    }
    try {
      await this.ensureSession()
      return { ok: true, engine: 'mcp', endpoint: this.url, pid: this.child?.pid || null }
    } catch (error) {
      return { ok: false, engine: 'mcp', endpoint: this.url, error: publicError(error)?.message || String(error) }
    }
  }

  async ensureStarted() {
    if (this.startFailed) throw this.startFailed
    if (this.child && this.child.exitCode === null) {
      if (!this.initialized) await this.waitReady()
      return
    }
    if (this.starting) return this.starting
    this.starting = this.start().finally(() => { this.starting = null })
    return this.starting
  }

  async start() {
    const binary = this.resolveBinary()
    this.log(`启动 sidecar：${binary}`)
    this.startError = null
    this.startFailed = null
    this.child = spawn(binary, [], {
      cwd: this.dataDir,
      env: { ...process.env, ...this.env },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.child.on('error', (error) => {
      this.startError = error
      this.log(`sidecar 启动错误：${String(error?.message || error)}`)
    })
    this.child.stdout?.on('data', (buf) => this.log(`[stdout] ${String(buf).trim()}`))
    this.child.stderr?.on('data', (buf) => this.log(`[stderr] ${String(buf).trim()}`))
    this.child.on('exit', (code) => {
      this.log(`sidecar 退出：${code ?? 'unknown'}`)
      this.child = null
      this.initialized = false
      this.sessionId = ''
    })
    try {
      await this.waitReady()
    } catch (error) {
      this.startFailed = error
      throw error
    }
  }

  resolveBinary() {
    const candidates = [
      this.binary,
      join(this.dataDir, 'bin', process.platform === 'win32' ? 'xiaohongshu-mcp.exe' : 'xiaohongshu-mcp'),
    ].filter(Boolean)
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }
    throw new EngineError(
      'ENGINE_UNAVAILABLE',
      '找不到 xiaohongshu-mcp 可执行文件。请在设置里填写 engineBinary，或把二进制放到插件 bin/ 目录。',
    )
  }

  async waitReady() {
    const deadline = Date.now() + this.startTimeoutMs
    let lastError = null
    while (Date.now() < deadline) {
      if (this.startError) {
        throw new EngineError('ENGINE_UNAVAILABLE', 'sidecar 启动失败', publicError(this.startError))
      }
      if (!this.child || this.child.exitCode !== null) {
        throw new EngineError('ENGINE_UNAVAILABLE', 'sidecar 已退出', lastError)
      }
      try {
        await this.ensureSession(true, false)
        return
      } catch (error) {
        lastError = error
        await delay(500)
      }
    }
    throw new EngineError('ENGINE_UNAVAILABLE', `sidecar 在 ${Math.round(this.startTimeoutMs / 1000)} 秒内没有就绪`, lastError)
  }

  async ensureSession(force = false, ensureProcess = true) {
    if (ensureProcess && !this.child) await this.ensureStarted()
    if (this.initialized && this.sessionId && !force) return
    this.initialized = false
    this.sessionId = ''
    this.protocolVersion = ''
    const versions = ['2025-03-26', '2024-11-05']
    let lastError = null
    for (const protocolVersion of versions) {
      try {
        const response = await this.post({
          jsonrpc: '2.0',
          id: this.nextId++,
          method: 'initialize',
          params: {
            protocolVersion,
            capabilities: {},
            clientInfo: { name: 'dsh-xhs-fish', version: '0.1.0' },
          },
        })
        if (!response) throw new EngineError('ENGINE_UNAVAILABLE', 'MCP initialize 无响应')
        if (response?.error) throw rpcError(response.error)
        this.initialized = true
        this.protocolVersion = protocolVersion
        await this.post({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
          params: {},
        }).catch(() => {})
        return
      } catch (error) {
        lastError = error
      }
    }
    throw new EngineError('ENGINE_UNAVAILABLE', 'MCP initialize 失败', publicError(lastError))
  }

  async post(body) {
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    }
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId
    if (this.protocolVersion) headers['mcp-protocol-version'] = this.protocolVersion
    let response
    try {
      response = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      })
    } catch (error) {
      const unknown = error?.name === 'TimeoutError' || error?.name === 'AbortError'
      throw new EngineError(
        unknown ? 'UNKNOWN_RESULT' : 'ENGINE_UNAVAILABLE',
        unknown ? 'sidecar 请求超时，结果不确定' : '无法连接 sidecar',
        publicError(error),
      )
    }
    const sessionId = response.headers.get('mcp-session-id')
    if (sessionId) this.sessionId = sessionId
    const contentType = response.headers.get('content-type') || ''
    const text = await response.text()
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new EngineError('AUTH_EXPIRED', `sidecar HTTP ${response.status}`)
      }
      if (response.status === 429) throw new EngineError('RATE_LIMITED', 'sidecar HTTP 429')
      throw new EngineError('ENGINE_ERROR', `sidecar HTTP ${response.status}`, text.slice(0, 500))
    }
    if (!text.trim()) return null
    if (contentType.includes('text/event-stream')) return parseSse(text)
    try {
      return JSON.parse(text)
    } catch {
      return { raw: text }
    }
  }

  async callTool(name, args = {}, { write = false } = {}) {
    await this.ensureSession()
    const call = async () => {
      const response = await this.post({
        jsonrpc: '2.0',
        id: this.nextId++,
        method: 'tools/call',
        params: { name, arguments: args },
      })
      if (!response) throw new EngineError('ENGINE_ERROR', `工具 ${name} 无响应`)
      if (response.error) throw rpcError(response.error)
      const result = response.result
      if (result?.isError) {
        const text = extractText(result)
        throw new EngineError('ENGINE_ERROR', text || `工具 ${name} 返回错误`, result)
      }
      return parseToolResult(result)
    }
    try {
      return await call()
    } catch (error) {
      if (write) throw error
      // 读操作最多重连一次；写操作绝不自动重试，避免重复发布/回复。
      this.initialized = false
      this.sessionId = ''
      await this.ensureSession(true)
      return call()
    }
  }

  async loginStatus() {
    const raw = await this.callTool('check_login_status', {})
    const root = raw?.data ?? raw
    const text = String(raw?.text || extractText(raw) || '')
    const textLoggedIn = /已登录|登录成功|logged in/i.test(text)
    const textLoggedOut = /未登录|not logged in/i.test(text)
    const explicit = Boolean(root?.loggedIn ?? root?.logged_in ?? root?.is_login ?? root?.isLogin ?? root?.success === true)
    const name = /用户名[:：]\s*([^\s]+)/.exec(text)?.[1] || ''
    const user = root?.user || root?.data?.user || (name ? { name } : null)
    return { loggedIn: explicit || (textLoggedIn && !textLoggedOut), user, raw }
  }

  async loginQr() {
    return this.callTool('get_login_qrcode', {})
  }

  async search({ query = '', limit = 10, filters = null } = {}) {
    const args = { keyword: String(query || '') }
    if (filters && typeof filters === 'object') args.filters = filters
    const result = await this.callTool('search_feeds', args)
    return { query: String(query || ''), limit, raw: result }
  }

  async feedDetail({ feedId = '', xsecToken = '', loadAllComments = false, limit = 20 } = {}) {
    if (!feedId || !xsecToken) throw new EngineError('ENGINE_ERROR', 'feedId 和 xsecToken 必填')
    return this.callTool('get_feed_detail', {
      feed_id: String(feedId),
      xsec_token: String(xsecToken),
      load_all_comments: Boolean(loadAllComments),
      limit: Math.max(1, Math.min(Number(limit) || 20, 100)),
    })
  }

  async publish({ title, content, images = [], tags = [], visibility = '仅自己可见' } = {}) {
    if (!title || !content || !Array.isArray(images) || !images.length) {
      throw new EngineError('ENGINE_ERROR', '发布需要 title、content、images')
    }
    return this.callTool('publish_content', {
      title: String(title),
      content: String(content),
      images: images.map(String),
      tags: Array.isArray(tags) ? tags.map(String) : [],
      visibility: String(visibility || '仅自己可见'),
    }, { write: true })
  }

  async reply({ feedId, xsecToken, commentId, content } = {}) {
    if (!feedId || !xsecToken || !commentId || !content) {
      throw new EngineError('ENGINE_ERROR', '回复需要 feedId、xsecToken、commentId、content')
    }
    return this.callTool('reply_comment_in_feed', {
      feed_id: String(feedId),
      xsec_token: String(xsecToken),
      comment_id: String(commentId),
      content: String(content),
    }, { write: true })
  }

  async close() {
    if (!this.child) return
    const child = this.child
    this.child = null
    this.initialized = false
    this.sessionId = ''
    try {
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { windowsHide: true, stdio: 'ignore' })
        killer.on('error', () => {})
      } else {
        child.kill('SIGTERM')
      }
    } catch {
      try { child.kill() } catch { /* ignore */ }
    }
  }

  log(message) {
    try {
      appendFileSync(this.logFile, `${new Date().toISOString()} ${message}\n`, 'utf8')
    } catch { /* ignore */ }
    try { this.logger?.info?.(`[xhs-fish] ${message}`) } catch { /* ignore */ }
  }
}

function parseSse(text) {
  const events = String(text).split(/\r?\n\r?\n/)
  let last = null
  for (const event of events) {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n')
    if (!data) continue
    try {
      last = JSON.parse(data)
    } catch { /* keep last valid */ }
  }
  return last
}

function parseToolResult(result) {
  if (!result || typeof result !== 'object') return result
  if (result.structuredContent !== undefined) return result.structuredContent
  const text = extractText(result)
  if (!text) return result
  try {
    return JSON.parse(text)
  } catch {
    return { text }
  }
}

function extractText(result) {
  const content = Array.isArray(result?.content) ? result.content : []
  return content
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n')
    .trim()
}

function rpcError(error) {
  const message = String(error?.message || 'MCP JSON-RPC error')
  return new EngineError('ENGINE_ERROR', message, error)
}

function publicError(error) {
  if (!error) return null
  return {
    name: String(error.name || 'Error'),
    code: String(error.code || ''),
    message: String(error.message || error).slice(0, 500),
  }
}
