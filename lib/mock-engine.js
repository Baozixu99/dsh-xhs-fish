/**
 * Mock engine：不连接小红书，用于 UI 开发、单元测试和首次安装。
 * 它不会产生任何真实平台请求。
 */
export class MockEngine {
  constructor() {
    this.loggedIn = false
    this.notes = [
      {
        noteId: 'mock_note_1',
        xsecToken: 'mock_xsec_1',
        title: '一条 AI 鱼的第一篇小红书',
        author: 'AI 虚拟角色',
        desc: '这是 mock 数据，不会发到真实小红书。',
        likedCount: 12,
        commentCount: 2,
        comments: [
          { id: 'mock_c1', author: '路人甲', text: '这个鱼好可爱，怎么做的？', likeCount: 3 },
          { id: 'mock_c2', author: '路人乙', text: '学到了，收藏了', likeCount: 1 },
        ],
      },
    ]
  }

  async health() {
    return { ok: true, engine: 'mock', loggedIn: this.loggedIn, message: 'Mock engine（不会访问小红书）' }
  }

  async loginStatus() {
    return { loggedIn: this.loggedIn, user: this.loggedIn ? { name: 'AI 虚拟角色（mock）', userId: 'mock_user' } : null }
  }

  async loginQr() {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#fff"/><rect x="20" y="20" width="80" height="80" fill="#111"/><rect x="140" y="20" width="80" height="80" fill="#111"/><rect x="20" y="140" width="80" height="80" fill="#111"/><text x="120" y="125" font-size="12" text-anchor="middle" fill="#ff2442">MOCK QR</text></svg>'
    return { qrDataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, expiresIn: 120 }
  }

  async mockLogin() {
    this.loggedIn = true
    return this.loginStatus()
  }

  async search({ query = '', limit = 10 } = {}) {
    const q = String(query || '').trim()
    const items = this.notes
      .filter((n) => !q || `${n.title}${n.desc}`.includes(q))
      .slice(0, Math.max(1, Math.min(Number(limit) || 10, 20)))
      .map((n) => ({
        noteId: n.noteId,
        xsecToken: n.xsecToken,
        title: n.title,
        author: n.author,
        desc: n.desc,
        likedCount: n.likedCount,
        commentCount: n.commentCount,
      }))
    return { query: q, count: items.length, items }
  }

  async feedDetail({ feedId, xsecToken } = {}) {
    const note = this.notes.find((n) => n.noteId === feedId) || this.notes[0]
    return {
      noteId: feedId || note.noteId,
      xsecToken: xsecToken || note.xsecToken,
      title: note.title,
      desc: note.desc,
      author: note.author,
      likedCount: note.likedCount,
      commentCount: note.commentCount,
      comments: note.comments.map((c) => ({ ...c })),
    }
  }

  async publish({ title, content, images = [], tags = [], visibility = '仅自己可见' } = {}) {
    const noteId = `mock_${Date.now()}`
    this.notes.unshift({
      noteId,
      xsecToken: `mock_xsec_${Date.now()}`,
      title,
      author: 'AI 虚拟角色',
      desc: content,
      likedCount: 0,
      commentCount: 0,
      comments: [],
    })
    return {
      ok: true,
      noteId,
      xsecToken: `mock_xsec_${noteId}`,
      url: `https://www.xiaohongshu.com/explore/${noteId}`,
      visibility,
      title,
      imageCount: images.length,
      tags,
      mock: true,
    }
  }

  async reply({ feedId, commentId, content } = {}) {
    return {
      ok: true,
      replyId: `mock_reply_${Date.now()}`,
      feedId,
      commentId,
      content,
      mock: true,
    }
  }

  async close() {}
}
