import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig, readJson, writeJsonAtomic } from './config.js'
import { newId, nowIso } from './ids.js'

export class Store {
  constructor(dataDir) {
    this.dir = dataDir
    mkdirSync(this.dir, { recursive: true })
    this.files = {
      drafts: join(this.dir, 'drafts.json'),
      approvals: join(this.dir, 'approvals.json'),
      posts: join(this.dir, 'posts.json'),
      comments: join(this.dir, 'comments.json'),
      replies: join(this.dir, 'replies.json'),
      audit: join(this.dir, 'audit.jsonl'),
    }
    this.config = loadConfig(this.dir)
  }

  reloadConfig() {
    this.config = loadConfig(this.dir)
    return this.config
  }

  read(name, fallback) {
    return readJson(this.files[name], fallback)
  }

  write(name, value) {
    writeJsonAtomic(this.files[name], value)
    return value
  }

  /* ── drafts ── */

  listDrafts() {
    const rows = this.read('drafts', [])
    return Array.isArray(rows) ? rows.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) : []
  }

  getDraft(id) {
    return this.listDrafts().find((d) => d.id === id) || null
  }

  createDraft(input = {}) {
    const now = nowIso()
    const draft = {
      id: newId('draft'),
      topic: String(input.topic || '').trim(),
      title: String(input.title || '').trim(),
      body: String(input.body || '').trim(),
      tags: normalizeTags(input.tags),
      images: normalizeImages(input.images),
      aiDisclosure: input.aiDisclosure !== false,
      status: 'draft',
      compliance: null,
      createdAt: now,
      updatedAt: now,
    }
    const rows = this.listDrafts()
    rows.unshift(draft)
    this.write('drafts', rows)
    return draft
  }

  updateDraft(id, patch = {}) {
    const rows = this.listDrafts()
    const i = rows.findIndex((d) => d.id === id)
    if (i < 0) return null
    rows[i] = { ...rows[i], ...patch, id, updatedAt: nowIso() }
    if (patch.tags !== undefined) rows[i].tags = normalizeTags(patch.tags)
    if (patch.images !== undefined) rows[i].images = normalizeImages(patch.images)
    this.write('drafts', rows)
    return rows[i]
  }

  /* ── approvals ── */

  listApprovals() {
    const rows = this.read('approvals', [])
    return Array.isArray(rows) ? rows.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) : []
  }

  getApproval(id) {
    return this.listApprovals().find((a) => a.id === id) || null
  }

  createApproval(input) {
    const approval = {
      id: newId('apr'),
      action: String(input.action || ''),
      targetId: String(input.targetId || ''),
      payloadHash: String(input.payloadHash || ''),
      summary: String(input.summary || '').slice(0, 500),
      preview: input.preview ?? null,
      status: 'pending',
      createdAt: nowIso(),
      expiresAt: String(input.expiresAt || ''),
      decidedAt: '',
      decidedBy: '',
      reason: '',
    }
    const rows = this.listApprovals()
    rows.unshift(approval)
    this.write('approvals', rows)
    return approval
  }

  updateApproval(id, patch = {}) {
    const rows = this.listApprovals()
    const i = rows.findIndex((a) => a.id === id)
    if (i < 0) return null
    rows[i] = { ...rows[i], ...patch, id }
    this.write('approvals', rows)
    return rows[i]
  }

  /* ── posts ── */

  listPosts() {
    const rows = this.read('posts', [])
    return Array.isArray(rows) ? rows.slice().sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt))) : []
  }

  addPost(input) {
    const post = {
      id: newId('post'),
      draftId: String(input.draftId || ''),
      xhsNoteId: String(input.xhsNoteId || ''),
      xsecToken: String(input.xsecToken || ''),
      url: String(input.url || ''),
      title: String(input.title || ''),
      visibility: String(input.visibility || ''),
      status: String(input.status || 'published'),
      publishedAt: nowIso(),
      raw: input.raw ?? null,
    }
    const rows = this.listPosts()
    rows.unshift(post)
    this.write('posts', rows)
    return post
  }

  /* ── comments ── */

  listComments(postId = '') {
    const rows = this.read('comments', [])
    const list = Array.isArray(rows) ? rows : []
    return (postId ? list.filter((c) => c.postId === postId) : list)
      .slice()
      .sort((a, b) => String(b.fetchedAt).localeCompare(String(a.fetchedAt)))
  }

  upsertComments(postId, comments = []) {
    const rows = this.read('comments', [])
    const list = Array.isArray(rows) ? rows : []
    const byKey = new Map(list.map((c) => [`${c.postId}:${c.xhsCommentId}`, c]))
    let added = 0
    for (const raw of comments) {
      const xhsCommentId = String(raw.id || raw.commentId || raw.rpid || raw.xhsCommentId || '').trim()
      if (!xhsCommentId) continue
      const key = `${postId}:${xhsCommentId}`
      const existing = byKey.get(key)
      const next = {
        id: existing?.id || newId('cmt'),
        postId,
        xhsCommentId,
        author: String(raw.author || raw.user?.nickname || raw.userName || '').slice(0, 80),
        authorId: String(raw.authorId || raw.user?.userId || raw.userId || '').slice(0, 80),
        text: String(raw.text || raw.content || '').slice(0, 1000),
        likeCount: Number(raw.likeCount || raw.like_count || 0) || 0,
        category: raw.category ?? existing?.category ?? '',
        status: existing?.status || 'new',
        fetchedAt: existing?.fetchedAt || nowIso(),
        repliedAt: existing?.repliedAt || '',
        replyId: existing?.replyId || '',
      }
      if (!existing) added += 1
      byKey.set(key, next)
    }
    const merged = [...byKey.values()]
    this.write('comments', merged)
    return { added, total: merged.filter((c) => c.postId === postId).length }
  }

  updateComment(id, patch = {}) {
    const rows = this.read('comments', [])
    const i = rows.findIndex((c) => c.id === id)
    if (i < 0) return null
    rows[i] = { ...rows[i], ...patch, id }
    this.write('comments', rows)
    return rows[i]
  }

  /* ── replies ── */

  listReplies() {
    const rows = this.read('replies', [])
    return Array.isArray(rows) ? rows : []
  }

  addReply(input) {
    const reply = {
      id: newId('rep'),
      commentId: String(input.commentId || ''),
      postId: String(input.postId || ''),
      text: String(input.text || ''),
      xhsReplyId: String(input.xhsReplyId || ''),
      status: String(input.status || 'sent'),
      createdAt: nowIso(),
      raw: input.raw ?? null,
    }
    const rows = this.listReplies()
    rows.unshift(reply)
    this.write('replies', rows)
    return reply
  }

  /* ── audit ── */

  audit(event = {}) {
    const row = {
      ts: nowIso(),
      actor: String(event.actor || 'system'),
      action: String(event.action || 'unknown'),
      target: String(event.target || ''),
      approvalId: String(event.approvalId || ''),
      payloadHash: String(event.payloadHash || ''),
      code: String(event.code || 'OK'),
      durationMs: Number(event.durationMs || 0) || 0,
      metaRedacted: redact(event.metaRedacted ?? {}),
    }
    if (!existsSync(this.files.audit)) mkdirSync(this.dir, { recursive: true })
    appendFileSync(this.files.audit, `${JSON.stringify(row)}\n`, 'utf8')
    return row
  }

  readAudit(limit = 100) {
    try {
      const lines = readFileSync(this.files.audit, 'utf8').split('\n').filter(Boolean)
      return lines.slice(-Math.max(1, Math.min(Number(limit) || 100, 1000))).reverse()
        .map((line) => {
          try { return JSON.parse(line) } catch { return null }
        })
        .filter(Boolean)
    } catch {
      return []
    }
  }

  countToday(action) {
    const day = new Date().toISOString().slice(0, 10)
    return this.readAudit(1000).filter((e) => e.action === action && String(e.ts).slice(0, 10) === day).length
  }

  stats() {
    return {
      drafts: this.listDrafts().length,
      pendingApprovals: this.listApprovals().filter((a) => a.status === 'pending').length,
      posts: this.listPosts().length,
      comments: this.listComments().length,
      replies: this.listReplies().length,
    }
  }
}

function normalizeTags(tags) {
  const list = Array.isArray(tags) ? tags : String(tags || '').split(/[,，\s#]+/)
  return [...new Set(list.map((s) => String(s || '').trim().replace(/^#/, '')).filter(Boolean))].slice(0, 10)
}

function normalizeImages(images) {
  const list = Array.isArray(images) ? images : String(images || '').split(/\r?\n/)
  return list.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 18)
}

function redact(value) {
  try {
    const text = JSON.stringify(value)
    return JSON.parse(text.replace(/("?(?:cookie|token|secret|password|session|authorization)"?\s*[:=]\s*")([^"]+)(")/gi, '$1[REDACTED]$3'))
  } catch {
    return {}
  }
}
