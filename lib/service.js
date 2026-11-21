import { MockEngine } from './mock-engine.js'
import {
  assertPublishable,
  buildPublishPayload,
  buildReplyPayload,
  checkDraft,
  classifyComment,
  normalizeTitle,
  topicCandidates,
} from './policy.js'

export class XhsService {
  constructor({ store, approval, engineManager, getConfig, saveConfig, logger = console }) {
    this.store = store
    this.approval = approval
    this.engineManager = engineManager
    this.getConfig = getConfig
    this.saveConfig = saveConfig
    this.logger = logger
  }

  async engine() {
    return this.engineManager.get()
  }

  config() {
    const cfg = this.getConfig()
    this.approval.refreshConfig(cfg)
    return cfg
  }

  assertWritable() {
    const cfg = this.config()
    if (!cfg.enabled) throw serviceError('PLUGIN_DISABLED', '插件已停用')
    if (cfg.paused) throw serviceError('PAUSED', 'Kill Switch 已暂停：请先恢复')
  }

  async status() {
    const cfg = this.config()
    let health = { ok: false, engine: cfg.engine, error: '未检查' }
    let login = { loggedIn: false, user: null }
    try {
      const engine = await this.engine()
      health = await engine.health()
      if (health.ok) login = await engine.loginStatus()
    } catch (error) {
      health = { ok: false, engine: cfg.engine, error: error.message }
      login = { loggedIn: false, user: null }
    }
    return {
      ok: true,
      config: cfg,
      health,
      login,
      stats: this.store.stats(),
      audit: this.store.readAudit(20),
    }
  }

  async loginStatus() {
    const engine = await this.engine()
    return engine.loginStatus()
  }

  async loginQr() {
    const engine = await this.engine()
    return engine.loginQr()
  }

  async mockLogin() {
    const engine = await this.engine()
    if (!(engine instanceof MockEngine)) throw serviceError('ENGINE_NOT_MOCK', '当前不是 mock 引擎')
    return engine.mockLogin()
  }

  async research({ query = '', limit = 10 } = {}) {
    const engine = await this.engine()
    const search = await engine.search({ query, limit })
    const items = normalizeSearchItems(search?.raw ?? search)
    return { ok: true, query, count: items.length, items }
  }

  async feedDetail({ feedId = '', xsecToken = '', loadAllComments = true } = {}) {
    const engine = await this.engine()
    const raw = await engine.feedDetail({ feedId, xsecToken, loadAllComments })
    const comments = normalizeComments(raw)
    return { ok: true, raw, note: normalizeNote(raw), comments }
  }

  topicCandidates() {
    const cfg = this.config()
    const comments = this.store.listComments()
    const recentTitles = [
      ...this.store.listDrafts().map((d) => d.title),
      ...this.store.listPosts().map((p) => p.title),
    ]
    return {
      ok: true,
      candidates: topicCandidates({ config: cfg, comments, recentTitles, count: 3 }),
    }
  }

  createDraft(input = {}) {
    const draft = this.store.createDraft(input)
    this.store.audit({ actor: 'human', action: 'draft_create', target: draft.id, code: 'OK' })
    return { ok: true, draft }
  }

  listDrafts() {
    return { ok: true, drafts: this.store.listDrafts() }
  }

  getDraft(id) {
    const draft = this.store.getDraft(id)
    if (!draft) throw serviceError('DRAFT_NOT_FOUND', '草稿不存在')
    return { ok: true, draft }
  }

  checkDraft(id) {
    const cfg = this.config()
    const draft = this.store.getDraft(id)
    if (!draft) throw serviceError('DRAFT_NOT_FOUND', '草稿不存在')
    const result = checkDraft(draft, { ...cfg, _recentTitles: this.recentTitles(id) })
    const updated = this.store.updateDraft(id, { compliance: result })
    this.store.audit({
      actor: 'agent',
      action: 'draft_compliance',
      target: id,
      code: result.ok ? 'OK' : 'CONTENT_REJECTED',
      metaRedacted: { issues: result.issues, warnings: result.warnings },
    })
    return { ok: result.ok, compliance: result, draft: updated }
  }

  preparePublish({ draftId, visibility } = {}) {
    this.assertWritable()
    const cfg = this.config()
    const draft = this.store.getDraft(draftId)
    if (!draft) throw serviceError('DRAFT_NOT_FOUND', '草稿不存在')
    if (draft.status === 'published') throw serviceError('DRAFT_ALREADY_PUBLISHED', '草稿已发布，不能再次准备发布')
    if (this.store.countToday('publish_commit') >= cfg.dailyPostLimit) {
      throw serviceError('DAILY_LIMIT', `今天已达到发布上限 ${cfg.dailyPostLimit}`)
    }
    const compliance = assertPublishable(draft, { ...cfg, _recentTitles: this.recentTitles(draft.id) })
    const allowedVisibility = ['仅自己可见', '公开可见', '仅互关好友可见']
    const chosenVisibility = allowedVisibility.includes(visibility) ? visibility : cfg.publishVisibility
    const payload = buildPublishPayload(draft, chosenVisibility)
    const approval = this.approval.create({
      action: 'publish',
      targetId: draft.id,
      payload,
      summary: `发布：${draft.title || '(无标题)'}`,
      preview: {
        title: draft.title,
        body: draft.body,
        tags: draft.tags,
        images: draft.images,
        visibility: payload.visibility,
      },
    })
    this.store.audit({
      actor: 'agent',
      action: 'publish_prepare',
      target: draft.id,
      approvalId: approval.id,
      payloadHash: approval.payloadHash,
      code: 'OK',
      metaRedacted: { warnings: compliance.warnings },
    })
    return { ok: true, approval, compliance, payload }
  }

  async commitPublish({ approvalId, draftId, confirm = false } = {}) {
    this.assertWritable()
    const cfg = this.config()
    const draft = this.store.getDraft(draftId)
    if (!draft) throw serviceError('DRAFT_NOT_FOUND', '草稿不存在')
    const approval = this.approval.get(approvalId)
    if (!approval) throw serviceError('APPROVAL_NOT_FOUND', '审批单不存在')
    if (approval.action !== 'publish') throw serviceError('ACTION_MISMATCH', '审批单不是发布动作')
    if (approval.targetId !== draft.id) throw serviceError('ACTION_MISMATCH', '审批单目标与草稿不一致')
    const allowedVisibility = ['仅自己可见', '公开可见', '仅互关好友可见']
    const requestedVisibility = String(approval.preview?.visibility || '')
    const visibility = allowedVisibility.includes(requestedVisibility)
      ? requestedVisibility
      : (cfg.publishVisibility || '仅自己可见')
    const payload = buildPublishPayload(draft, visibility)
    if (this.store.countToday('publish_commit') >= cfg.dailyPostLimit) {
      throw serviceError('DAILY_LIMIT', `今天已达到发布上限 ${cfg.dailyPostLimit}`)
    }
    this.approval.claim(approvalId, payload, { confirm })
    const startedAt = Date.now()
    let sent = false
    try {
      const engine = await this.engine()
      const result = await engine.publish(payload)
      sent = true
      const normalized = normalizePublish(result)
      const post = this.store.addPost({
        draftId: draft.id,
        xhsNoteId: normalized.noteId,
        xsecToken: normalized.xsecToken,
        url: normalized.url,
        title: draft.title,
        visibility: payload.visibility,
        status: (normalized.published || normalized.noteId) ? 'published' : 'published_unknown_id',
        raw: result,
      })
      this.store.updateDraft(draft.id, { status: 'published' })
      this.approval.consume(approvalId, payload, { confirm: true })
      this.store.audit({
        actor: 'human',
        action: 'publish_commit',
        target: draft.id,
        approvalId,
        payloadHash: approval.payloadHash,
        code: 'OK',
        durationMs: Date.now() - startedAt,
        metaRedacted: { noteId: normalized.noteId, visibility: payload.visibility },
      })
      return { ok: true, post, result: normalized }
    } catch (error) {
      if (sent || isUnknownResult(error)) this.approval.markUnknown(approvalId, error.message)
      else this.approval.release(approvalId)
      this.store.audit({
        actor: 'human',
        action: 'publish_commit',
        target: draft.id,
        approvalId,
        code: error.code || 'ENGINE_ERROR',
        durationMs: Date.now() - startedAt,
        metaRedacted: { message: error.message },
      })
      throw error
    }
  }

  listApprovals() {
    return { ok: true, approvals: this.store.listApprovals() }
  }

  approve(id) {
    const approval = this.approval.approve(id, 'human')
    this.store.audit({ actor: 'human', action: 'approval_approve', target: id, approvalId: id, code: 'OK' })
    return { ok: true, approval }
  }

  reject(id, reason = '') {
    const approval = this.approval.reject(id, reason, 'human')
    this.store.audit({ actor: 'human', action: 'approval_reject', target: id, approvalId: id, code: 'OK', metaRedacted: { reason } })
    return { ok: true, approval }
  }

  async syncInbox({ postId = '', feedId = '', xsecToken = '' } = {}) {
    let noteId = feedId
    let token = xsecToken
    if (postId) {
      const post = this.store.listPosts().find((p) => p.id === postId)
      if (!post) throw serviceError('POST_NOT_FOUND', '发布记录不存在')
      noteId = noteId || post.xhsNoteId
      token = token || post.xsecToken
    }
    if (!noteId || !token) throw serviceError('MISSING_FEED_TOKEN', '同步评论需要 feedId 和 xsecToken（发布结果未保存时请手动填写）')
    const engine = await this.engine()
    const raw = await engine.feedDetail({ feedId: noteId, xsecToken: token, loadAllComments: true })
    let post = this.store.listPosts().find((p) => p.xhsNoteId === noteId)
    if (!post) {
      const note = normalizeNote(raw)
      post = this.store.addPost({
        xhsNoteId: noteId,
        xsecToken: token,
        title: note?.title || noteId,
        visibility: 'unknown',
        status: 'synced',
        raw: null,
      })
    }
    const comments = normalizeComments(raw).map((c) => ({ ...c, category: classifyComment(c.text) }))
    const result = this.store.upsertComments(noteId, comments)
    this.store.audit({ actor: 'agent', action: 'inbox_sync', target: noteId, code: 'OK', metaRedacted: result })
    return { ok: true, postId: post.id, feedId: noteId, ...result, comments: this.store.listComments(noteId) }
  }

  listComments(postId = '') {
    const post = postId ? this.store.listPosts().find((p) => p.id === postId) : null
    return { ok: true, comments: this.store.listComments(post?.xhsNoteId || postId) }
  }

  prepareReply({ commentId, content } = {}) {
    this.assertWritable()
    const cfg = this.config()
    if (this.store.countToday('reply_commit') >= cfg.dailyReplyLimit) {
      throw serviceError('DAILY_LIMIT', `今天已达到回复上限 ${cfg.dailyReplyLimit}`)
    }
    const comment = this.store.listComments().find((c) => c.id === commentId)
    if (!comment) throw serviceError('COMMENT_NOT_FOUND', '评论不存在')
    const text = String(content || '').trim()
    if (!text) throw serviceError('EMPTY_REPLY', '回复内容不能为空')
    if (text.length > 500) throw serviceError('CONTENT_REJECTED', '回复超过 500 字')
    const post = this.store.listPosts().find((p) => p.xhsNoteId === comment.postId)
    if (!post) throw serviceError('POST_NOT_FOUND', '找不到这条评论对应的发布记录')
    const payload = buildReplyPayload({
      feedId: post.xhsNoteId,
      xsecToken: post.xsecToken,
      commentId: comment.xhsCommentId,
      content: text,
    })
    const approval = this.approval.create({
      action: 'reply',
      targetId: comment.id,
      payload,
      summary: `回复 @${comment.author || '用户'}：${text.slice(0, 80)}`,
      preview: { author: comment.author, comment: comment.text, reply: text },
    })
    this.store.audit({
      actor: 'agent',
      action: 'reply_prepare',
      target: comment.id,
      approvalId: approval.id,
      payloadHash: approval.payloadHash,
      code: 'OK',
    })
    return { ok: true, approval, payload }
  }

  async commitReply({ approvalId, confirm = false } = {}) {
    this.assertWritable()
    const cfg = this.config()
    if (this.store.countToday('reply_commit') >= cfg.dailyReplyLimit) {
      throw serviceError('DAILY_LIMIT', `今天已达到回复上限 ${cfg.dailyReplyLimit}`)
    }
    const approval = this.approval.get(approvalId)
    if (!approval) throw serviceError('APPROVAL_NOT_FOUND', '审批单不存在')
    if (approval.action !== 'reply') throw serviceError('ACTION_MISMATCH', '审批单不是回复动作')
    // 审批单里不存完整 payload；从评论与回复预览重建，保证 hash 校验可复现。
    const comment = this.store.listComments().find((c) => c.id === approval.targetId)
    if (!comment) throw serviceError('COMMENT_NOT_FOUND', '评论不存在')
    const post = this.store.listPosts().find((p) => p.xhsNoteId === comment.postId)
    if (!post) throw serviceError('POST_NOT_FOUND', '找不到这条评论对应的发布记录')
    const content = String(approval.preview?.reply || '').trim()
    const payload = buildReplyPayload({
      feedId: post.xhsNoteId,
      xsecToken: post.xsecToken,
      commentId: comment.xhsCommentId,
      content,
    })
    this.approval.claim(approvalId, payload, { confirm })
    const startedAt = Date.now()
    let sent = false
    try {
      const engine = await this.engine()
      const result = await engine.reply(payload)
      sent = true
      const reply = this.store.addReply({
        commentId: comment.id,
        postId: post.xhsNoteId,
        text: content,
        xhsReplyId: String(result?.replyId || result?.reply_id || ''),
        status: 'sent',
        raw: result,
      })
      this.store.updateComment(comment.id, {
        status: 'replied',
        repliedAt: new Date().toISOString(),
        replyId: reply.id,
      })
      this.approval.consume(approvalId, payload, { confirm: true })
      this.store.audit({
        actor: 'human',
        action: 'reply_commit',
        target: comment.id,
        approvalId,
        payloadHash: approval.payloadHash,
        code: 'OK',
        durationMs: Date.now() - startedAt,
      })
      return { ok: true, reply, result }
    } catch (error) {
      if (sent || isUnknownResult(error)) this.approval.markUnknown(approvalId, error.message)
      else this.approval.release(approvalId)
      this.store.audit({
        actor: 'human',
        action: 'reply_commit',
        target: comment.id,
        approvalId,
        code: error.code || 'ENGINE_ERROR',
        durationMs: Date.now() - startedAt,
        metaRedacted: { message: error.message },
      })
      throw error
    }
  }

  /**
   * 人工对账：发送结果 unknown 时，人工确认平台侧是否已成功。
   * outcome=sent 会补写 reply 记录并把审批置为 consumed；outcome=not_sent 只释放审批。
   */
  reconcileApproval({ approvalId, outcome = 'sent', replyId = '' } = {}) {
    const approval = this.approval.get(approvalId)
    if (!approval) throw serviceError('APPROVAL_NOT_FOUND', '审批单不存在')
    if (approval.action !== 'reply') throw serviceError('ACTION_MISMATCH', '目前只支持回复类审批对账')
    const comment = this.store.listComments().find((c) => c.id === approval.targetId)
    if (!comment) throw serviceError('COMMENT_NOT_FOUND', '评论不存在')
    const post = this.store.listPosts().find((p) => p.xhsNoteId === comment.postId)
    if (!post) throw serviceError('POST_NOT_FOUND', '找不到这条评论对应的发布记录')
    const content = String(approval.preview?.reply || '').trim()
    const payload = buildReplyPayload({
      feedId: post.xhsNoteId,
      xsecToken: post.xsecToken,
      commentId: comment.xhsCommentId,
      content,
    })
    if (outcome === 'not_sent') {
      const next = this.approval.reconcileNotSent(approvalId)
      this.store.audit({ actor: 'human', action: 'approval_reconcile', target: approvalId, approvalId, code: 'NOT_SENT' })
      return { ok: true, approval: next, sent: false }
    }
    if (outcome !== 'sent') throw serviceError('BAD_OUTCOME', 'outcome 只能是 sent 或 not_sent')
    const next = this.approval.reconcileSent(approvalId, payload, { confirm: true })
    let reply = this.store.listReplies().find((r) => r.commentId === comment.id)
    if (!reply) {
      reply = this.store.addReply({
        commentId: comment.id,
        postId: post.xhsNoteId,
        text: content,
        xhsReplyId: String(replyId || ''),
        status: 'sent',
        raw: { reconciled: true },
      })
    }
    this.store.updateComment(comment.id, {
      status: 'replied',
      repliedAt: new Date().toISOString(),
      replyId: reply.id,
    })
    this.store.audit({ actor: 'human', action: 'approval_reconcile', target: approvalId, approvalId, code: 'SENT' })
    return { ok: true, approval: next, reply, sent: true }
  }

  listPosts() {
    return { ok: true, posts: this.store.listPosts() }
  }

  listAudit(limit = 100) {
    return { ok: true, events: this.store.readAudit(limit) }
  }

  updateConfig(patch = {}) {
    const next = this.saveConfig(patch)
    this.store.audit({ actor: 'human', action: 'config_update', target: 'config', code: 'OK', metaRedacted: { keys: Object.keys(patch || {}) } })
    return { ok: true, config: next }
  }

  kill(reason = '') {
    const next = this.saveConfig({ paused: true })
    this.store.audit({ actor: 'human', action: 'kill_switch', target: 'config', code: 'OK', metaRedacted: { reason } })
    return { ok: true, config: next }
  }

  resume() {
    const next = this.saveConfig({ paused: false })
    this.store.audit({ actor: 'human', action: 'kill_switch_resume', target: 'config', code: 'OK' })
    return { ok: true, config: next }
  }

  recentTitles(excludeDraftId = '') {
    return [
      ...this.store.listDrafts().filter((d) => d.id !== excludeDraftId).map((d) => d.title),
      ...this.store.listPosts().map((p) => p.title),
    ].filter(Boolean).map(normalizeTitle)
  }
}

function serviceError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function isUnknownResult(error) {
  return String(error?.code || '') === 'UNKNOWN_RESULT'
}

function normalizeSearchItems(result) {
  const root = result?.data ?? result
  const items = root?.items || root?.data?.items || root?.feeds || []
  return (Array.isArray(items) ? items : []).map((item) => {
    const card = item.noteCard || item.note_card || item.note || {}
    return {
      noteId: String(item.noteId || item.note_id || item.id || card.noteId || card.note_id || ''),
      xsecToken: String(item.xsecToken || item.xsec_token || card.xsecToken || card.xsec_token || ''),
      title: String(item.title || item.display_title || item.desc || card.displayTitle || card.display_title || card.title || card.desc || '').slice(0, 120),
      author: String(item.author || item.user?.nickname || item.nickname || card.user?.nickname || card.user?.nickName || '').slice(0, 80),
      desc: String(item.desc || item.content || card.desc || '').slice(0, 500),
      likedCount: Number(item.likedCount || item.liked_count || item.interactInfo?.likedCount || card.interactInfo?.likedCount || 0) || 0,
      commentCount: Number(item.commentCount || item.comment_count || item.interactInfo?.commentCount || card.interactInfo?.commentCount || 0) || 0,
    }
  }).filter((item) => item.noteId)
}

function normalizeNote(result) {
  const root = result?.data ?? result
  const note = root?.note || root?.data?.note || root
  return {
    noteId: String(note?.noteId || note?.note_id || note?.id || ''),
    xsecToken: String(note?.xsecToken || note?.xsec_token || ''),
    title: String(note?.title || note?.display_title || ''),
    desc: String(note?.desc || note?.content || ''),
    author: String(note?.author || note?.user?.nickname || ''),
  }
}

function normalizeComments(result) {
  const root = result?.data ?? result
  const candidates = [
    root?.comments,
    root?.comments?.list,
    root?.comment_list,
    root?.data?.comments,
    root?.data?.comments?.list,
    root?.data?.comment_list,
    root?.data?.data?.comments,
    root?.note?.comments,
  ]
  const list = candidates.find((x) => Array.isArray(x)) || []
  return list.map((c) => ({
    id: String(c.id || c.commentId || c.comment_id || c.rpid || ''),
    author: String(c.author || c.user?.nickname || c.user_info?.nickname || c.userInfo?.nickname || c.nickname || ''),
    authorId: String(c.authorId || c.user?.userId || c.user_info?.user_id || c.userInfo?.userId || ''),
    text: String(c.text || c.content || c.note || '').slice(0, 1000),
    likeCount: Number(c.likeCount || c.like_count || 0) || 0,
  })).filter((c) => c.id)
}

function normalizePublish(result) {
  const root = result?.data ?? result
  const text = String(result?.text || result?.message || '')
  const noteId = String(
    result?.noteId || result?.note_id ||
    root?.noteId || root?.note_id || root?.id ||
    result?.data?.noteId || '',
  )
  const xsecToken = String(result?.xsecToken || result?.xsec_token || root?.xsecToken || root?.xsec_token || '')
  const url = String(result?.url || result?.note_url || root?.url || (noteId ? `https://www.xiaohongshu.com/explore/${noteId}` : ''))
  const published = /发布成功|published successfully|publish success/i.test(text)
  return { noteId, xsecToken, url, published }
}
