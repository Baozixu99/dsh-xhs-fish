const MAX_BODY = 1_000_000
const MOUNT = '/api/xhs-fish'

export function createHttpHandler(service) {
  return async function handler(req, res) {
    try {
      assertLocalRequest(req)
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      const rawPath = url.pathname || '/'
      const path = rawPath === MOUNT || rawPath.startsWith(`${MOUNT}/`)
        ? (rawPath.slice(MOUNT.length).replace(/\/+$/, '') || '/')
        : (rawPath.replace(/\/+$/, '') || '/')
      const method = String(req.method || 'GET').toUpperCase()

      if (method === 'GET' && path === '/status') return sendJson(res, 200, await service.status())
      if (method === 'GET' && path === '/config') return sendJson(res, 200, { ok: true, config: service.config() })
      if (method === 'POST' && path === '/config') {
        return sendJson(res, 200, service.updateConfig(await readJson(req)))
      }
      if (method === 'POST' && path === '/kill') {
        const body = await readJson(req)
        return sendJson(res, 200, service.kill(body.reason || ''))
      }
      if (method === 'POST' && path === '/resume') return sendJson(res, 200, service.resume())

      if (method === 'GET' && path === '/login/status') return sendJson(res, 200, await service.loginStatus())
      if (method === 'GET' && path === '/login/qr') return sendJson(res, 200, await service.loginQr())
      if (method === 'POST' && path === '/login/mock') return sendJson(res, 200, await service.mockLogin())

      if (method === 'GET' && path === '/drafts') return sendJson(res, 200, service.listDrafts())
      if (method === 'POST' && path === '/drafts') return sendJson(res, 200, service.createDraft(await readJson(req)))
      {
        const m = /^\/drafts\/([^/]+)$/.exec(path)
        if (method === 'GET' && m) return sendJson(res, 200, service.getDraft(decodeURIComponent(m[1])))
        const c = /^\/drafts\/([^/]+)\/compliance$/.exec(path)
        if (method === 'POST' && c) return sendJson(res, 200, service.checkDraft(decodeURIComponent(c[1])))
      }

      if (method === 'GET' && path === '/approvals') return sendJson(res, 200, service.listApprovals())
      {
        const a = /^\/approvals\/([^/]+)\/approve$/.exec(path)
        if (method === 'POST' && a) return sendJson(res, 200, service.approve(decodeURIComponent(a[1])))
        const r = /^\/approvals\/([^/]+)\/reject$/.exec(path)
        if (method === 'POST' && r) {
          const body = await readJson(req)
          return sendJson(res, 200, service.reject(decodeURIComponent(r[1]), body.reason || ''))
        }
      }

      if (method === 'POST' && path === '/publish/prepare') return sendJson(res, 200, service.preparePublish(await readJson(req)))
      if (method === 'POST' && path === '/publish/commit') {
        return sendJson(res, 200, await service.commitPublish(await readJson(req)))
      }
      if (method === 'GET' && path === '/posts') return sendJson(res, 200, service.listPosts())

      if (method === 'GET' && path === '/inbox') {
        return sendJson(res, 200, service.listComments(url.searchParams.get('postId') || ''))
      }
      if (method === 'POST' && path === '/inbox/sync') return sendJson(res, 200, await service.syncInbox(await readJson(req)))

      if (method === 'POST' && path === '/reply/prepare') return sendJson(res, 200, service.prepareReply(await readJson(req)))
      if (method === 'POST' && path === '/reply/commit') {
        return sendJson(res, 200, await service.commitReply(await readJson(req)))
      }

      if (method === 'GET' && path === '/audit') {
        const limit = Number(url.searchParams.get('limit') || 100)
        return sendJson(res, 200, service.listAudit(limit))
      }

      return sendJson(res, 404, { ok: false, code: 'NOT_FOUND', error: `unknown ${method} ${path}` })
    } catch (error) {
      const status = statusFor(error)
      return sendJson(res, status, {
        ok: false,
        code: String(error.code || 'ERROR'),
        error: String(error.message || error),
        details: error.issues || undefined,
      })
    }
  }
}

function statusFor(error) {
  const code = String(error?.code || '')
  if (['APPROVAL_NOT_FOUND', 'DRAFT_NOT_FOUND', 'COMMENT_NOT_FOUND', 'POST_NOT_FOUND'].includes(code)) return 404
  if (['APPROVAL_MISMATCH', 'APPROVAL_CONSUMED', 'APPROVAL_EXPIRED', 'APPROVAL_REQUIRED', 'APPROVAL_SENDING', 'APPROVAL_STATE', 'CONFIRM_REQUIRED', 'DAILY_LIMIT', 'PAUSED', 'PLUGIN_DISABLED', 'ACTION_MISMATCH', 'DRAFT_ALREADY_PUBLISHED', 'UNKNOWN_RESULT'].includes(code)) return 409
  if (['CONTENT_REJECTED', 'ENGINE_ERROR', 'EMPTY_REPLY', 'MISSING_FEED_TOKEN', 'BAD_JSON'].includes(code)) return 400
  if (code === 'BODY_TOO_LARGE') return 413
  if (code === 'FORBIDDEN') return 403
  if (code === 'ENGINE_UNAVAILABLE' || code === 'AUTH_EXPIRED' || code === 'RATE_LIMITED') return 503
  return 500
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value ?? null)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) {
      const error = new Error('请求体过大')
      error.code = 'BODY_TOO_LARGE'
      throw error
    }
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    const error = new Error('请求体不是合法 JSON')
    error.code = 'BAD_JSON'
    throw error
  }
}

function assertLocalRequest(req) {
  const headers = req?.headers || {}
  const site = String(headers['sec-fetch-site'] || '')
  if (site && site !== 'same-origin' && site !== 'none') {
    throw httpError('FORBIDDEN', '只接受同源请求')
  }
  const origin = headers.origin
  if (origin && origin !== 'null') {
    try {
      if (new URL(origin).host !== headers.host) throw new Error('origin mismatch')
    } catch {
      throw httpError('FORBIDDEN', 'Origin 校验失败')
    }
  }
  const remote = req?.socket?.remoteAddress
  if (remote && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) {
    throw httpError('FORBIDDEN', '只接受本机请求')
  }
}

function httpError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}
