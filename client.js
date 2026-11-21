window.__ModuleLoader__.load({
  id: 'dsh-xhs-fish',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useState } = React

    const API = '/api/xhs-fish'
    const jget = async (path) => {
      try {
        const r = await fetch(API + path, { headers: { accept: 'application/json' } })
        return await r.json()
      } catch (error) {
        return { ok: false, error: String(error?.message || error) }
      }
    }
    const jpost = async (path, body) => {
      try {
        const r = await fetch(API + path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body || {}),
        })
        return await r.json()
      } catch (error) {
        return { ok: false, error: String(error?.message || error) }
      }
    }
    const errText = (r) => String(r?.error || r?.message || r?.details?.join?.('；') || '')
    const asList = (r, key) => (Array.isArray(r?.[key]) ? r[key] : [])
    const qrUrl = (r) => {
      let value = r
      if (typeof r?.text === 'string') {
        try { value = JSON.parse(r.text) } catch { value = r }
      }
      const direct = value?.qrDataUrl || value?.qr_data_url || value?.data?.qrDataUrl || value?.data?.qr_data_url
      if (direct) return direct
      const base64 = value?.qr_base64 || value?.data?.qr_base64
      return base64 ? `data:image/png;base64,${base64}` : ''
    }

    const CSS = `
[data-xhs-root]{--bg:var(--dsw-alias-bg-base,#fff);--panel:var(--dsw-alias-bg-layer-1,#fff);--line:color-mix(in srgb,var(--dsw-alias-label-primary,#111) 12%,transparent);--tx:var(--dsw-alias-label-primary,#111);--dim:var(--dsw-alias-label-secondary,#666);--acc:#ff2442;--ok:#16a34a;--warn:#d97706;--bad:#dc2626;display:flex;height:calc(100vh - 76px);min-height:460px;background:var(--bg);color:var(--tx);font:13.5px/1.5 "Microsoft YaHei","Segoe UI",system-ui,sans-serif;overflow:hidden}
[data-xhs-root] *{box-sizing:border-box}
[data-xhs-rail]{width:176px;flex:none;background:color-mix(in srgb,var(--tx) 3%,var(--bg));border-right:1px solid var(--line);padding:14px 8px;display:flex;flex-direction:column;gap:3px}
[data-xhs-brand]{font-weight:800;font-size:15px;padding:6px 12px 14px;white-space:nowrap}
[data-xhs-brand] small{display:block;font-size:11px;font-weight:400;color:var(--dim);margin-top:3px}
[data-xhs-nav]{border:0;border-radius:8px;background:transparent;color:var(--dim);text-align:left;padding:9px 11px;font:inherit;cursor:pointer;white-space:nowrap}
[data-xhs-nav]:hover{background:color-mix(in srgb,var(--tx) 6%,transparent);color:var(--tx)}
[data-xhs-nav][aria-selected="true"]{background:color-mix(in srgb,var(--acc) 13%,transparent);color:var(--acc);font-weight:700}
[data-xhs-main]{flex:1;min-width:0;overflow:auto;padding:18px 22px 30px}
[data-xhs-page]{display:flex;flex-direction:column;gap:12px;max-width:1120px}
[data-xhs-head]{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
[data-xhs-title]{font-size:19px;font-weight:800}
[data-xhs-sub]{font-size:12px;color:var(--dim)}
[data-xhs-grow]{flex:1;min-width:0}
[data-xhs-row]{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
[data-xhs-col]{display:flex;flex-direction:column;gap:9px}
[data-xhs-btn]{border:1px solid var(--line);background:color-mix(in srgb,var(--tx) 4%,transparent);color:var(--tx);border-radius:8px;padding:6px 11px;font:inherit;cursor:pointer;white-space:nowrap}
[data-xhs-btn]:hover{border-color:color-mix(in srgb,var(--acc) 55%,transparent)}
[data-xhs-btn][data-primary]{background:var(--acc);border-color:var(--acc);color:#fff;font-weight:700}
[data-xhs-btn][disabled]{opacity:.45;cursor:not-allowed}
[data-xhs-chip]{font-size:11px;border:1px solid var(--line);border-radius:999px;padding:2px 8px;color:var(--dim);white-space:nowrap}
[data-xhs-chip][data-ok]{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 45%,transparent)}
[data-xhs-chip][data-bad]{color:var(--bad);border-color:color-mix(in srgb,var(--bad) 45%,transparent)}
[data-xhs-chip][data-warn]{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,transparent)}
[data-xhs-sec]{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:13px;display:flex;flex-direction:column;gap:9px}
[data-xhs-h]{font-size:11px;font-weight:700;color:var(--dim);letter-spacing:.04em}
[data-xhs-note]{font-size:11.5px;line-height:1.6;color:var(--dim)}
[data-xhs-input],[data-xhs-area]{width:100%;border:1px solid var(--line);background:color-mix(in srgb,var(--tx) 3%,transparent);color:var(--tx);border-radius:8px;padding:7px 9px;font:inherit}
[data-xhs-area]{min-height:110px;resize:vertical;line-height:1.6}
[data-xhs-input]:focus,[data-xhs-area]:focus{outline:none;border-color:var(--acc)}
[data-xhs-meta]{font-size:11.5px;color:var(--dim);word-break:break-word}
[data-xhs-pre]{white-space:pre-wrap;word-break:break-word;background:color-mix(in srgb,var(--tx) 4%,transparent);border-radius:8px;padding:8px;font:11.5px/1.6 Consolas,ui-monospace,monospace;max-height:240px;overflow:auto}
[data-xhs-card]{border:1px solid var(--line);border-radius:11px;background:var(--panel);padding:11px;display:flex;flex-direction:column;gap:6px}
[data-xhs-card] b{font-size:13.5px}
[data-xhs-warn]{font-size:12px;color:var(--warn);line-height:1.5}
[data-xhs-bad]{font-size:12px;color:var(--bad);line-height:1.5}
[data-xhs-ok]{font-size:12px;color:var(--ok);line-height:1.5}
[data-xhs-qr]{width:180px;height:180px;border:1px solid var(--line);border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden}
[data-xhs-qr] img{width:100%;height:100%;object-fit:contain}
[data-xhs-grid]{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
[data-xhs-stat]{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--panel)}
[data-xhs-stat] b{display:block;font-size:20px;line-height:1.2}
[data-xhs-stat] span{font-size:11.5px;color:var(--dim)}
`

    const NAV = [
      ['overview', '概览'],
      ['drafts', '草稿'],
      ['approvals', '审批'],
      ['inbox', '评论'],
      ['settings', '设置'],
      ['audit', '日志'],
    ]

    function Shell() {
      const [tab, setTab] = useState('overview')
      const [status, setStatus] = useState(null)
      const [drafts, setDrafts] = useState([])
      const [approvals, setApprovals] = useState([])
      const [posts, setPosts] = useState([])
      const [comments, setComments] = useState([])
      const [audit, setAudit] = useState([])
      const [qr, setQr] = useState('')
      const [msg, setMsg] = useState('')
      const [busy, setBusy] = useState('')

      const refreshStatus = async () => {
        const r = await jget('/status')
        setStatus(r)
      }
      const refreshDrafts = async () => setDrafts(asList(await jget('/drafts'), 'drafts'))
      const refreshApprovals = async () => setApprovals(asList(await jget('/approvals'), 'approvals'))
      const refreshPosts = async () => setPosts(asList(await jget('/posts'), 'posts'))
      const refreshAudit = async () => setAudit(asList(await jget('/audit?limit=80'), 'events'))
      const refreshAll = async () => {
        await Promise.all([refreshStatus(), refreshDrafts(), refreshApprovals(), refreshPosts(), refreshAudit()])
      }
      useEffect(() => { refreshAll() }, [])
      useEffect(() => {
        const t = setInterval(() => { refreshStatus().catch(() => {}) }, 5000)
        return () => clearInterval(t)
      }, [])

      const run = async (key, fn) => {
        setBusy(key)
        setMsg('')
        try {
          const r = await fn()
          if (r && r.ok === false) setMsg(errText(r) || '操作失败')
          else setMsg('完成')
          await refreshAll()
          return r
        } catch (error) {
          setMsg(String(error?.message || error))
          return { ok: false, error: String(error?.message || error) }
        } finally {
          setBusy('')
        }
      }

      const loginQr = () => run('qr', async () => {
        const r = await jget('/login/qr')
        if (r.ok === false) return r
        setQr(qrUrl(r))
        return r
      })
      const mockLogin = () => run('mock', () => jpost('/login/mock', {}))
      const kill = () => run('kill', () => jpost('/kill', { reason: 'manual' }))
      const resume = () => run('resume', () => jpost('/resume', {}))

      return h('div', { 'data-xhs-root': '' },
        h('aside', { 'data-xhs-rail': '' },
          h('div', { 'data-xhs-brand': '' }, '小红书工作台', h('small', {}, 'AI 主理人 · 人工审批')),
          ...NAV.map(([k, label]) => h('button', {
            key: k,
            'data-xhs-nav': '',
            'aria-selected': tab === k ? 'true' : 'false',
            onClick: () => setTab(k),
          }, label)),
          h('div', { style: { marginTop: 'auto', padding: '8px 4px 0', borderTop: '1px solid var(--line)' } },
            h('button', { 'data-xhs-btn': '', style: { width: '100%' }, onClick: refreshAll }, '刷新'))),
        h('main', { 'data-xhs-main': '' },
          h('div', { 'data-xhs-page': '' },
            h('div', { 'data-xhs-head': '' },
              h('div', {}, h('div', { 'data-xhs-title': '' }, tabTitle(tab)), h('div', { 'data-xhs-sub': '' }, 'AI 负责准备，人负责发布和回复')),
              h('div', { 'data-xhs-grow': '' }),
              status?.config?.paused ? h('span', { 'data-xhs-chip': '', 'data-bad': '' }, 'Kill Switch 已暂停') : h('span', { 'data-xhs-chip': '', 'data-ok': '' }, '运行中'),
              h('span', { 'data-xhs-chip': '' }, `引擎 ${status?.config?.engine || '-'}`)),
            msg ? h('div', { 'data-xhs-note': '' }, msg) : null,
            tab === 'overview' ? h(Overview, { status, qr, loginQr, mockLogin, kill, resume, busy, refreshStatus }) : null,
            tab === 'drafts' ? h(Drafts, { drafts, busy, run, refreshDrafts }) : null,
            tab === 'approvals' ? h(Approvals, { approvals, busy, run, refreshApprovals }) : null,
            tab === 'inbox' ? h(Inbox, { posts, comments, setComments, busy, run, refreshPosts }) : null,
            tab === 'settings' ? h(Settings, { status, busy, run }) : null,
            tab === 'audit' ? h(Audit, { audit, refreshAudit }) : null)))
    }

    function tabTitle(tab) {
      return { overview: '概览', drafts: '草稿', approvals: '审批', inbox: '评论收件箱', settings: '设置', audit: '运行日志' }[tab] || '小红书工作台'
    }

    function Overview({ status, qr, loginQr, mockLogin, kill, resume, busy, refreshStatus }) {
      const cfg = status?.config || {}
      const health = status?.health || {}
      const login = status?.login || {}
      const stats = status?.stats || {}
      return h('div', { 'data-xhs-col': '' },
        h('div', { 'data-xhs-grid': '' },
          h('div', { 'data-xhs-stat': '' }, h('b', {}, stats.pendingApprovals ?? 0), h('span', {}, '待审批')),
          h('div', { 'data-xhs-stat': '' }, h('b', {}, stats.drafts ?? 0), h('span', {}, '本地草稿')),
          h('div', { 'data-xhs-stat': '' }, h('b', {}, stats.posts ?? 0), h('span', {}, '已发布记录')),
          h('div', { 'data-xhs-stat': '' }, h('b', {}, stats.comments ?? 0), h('span', {}, '评论收件箱'))),
        h('div', { 'data-xhs-sec': '' },
          h('div', { 'data-xhs-h': '' }, '引擎与登录'),
          h('div', { 'data-xhs-row': '' },
            h('span', { 'data-xhs-chip': '', 'data-ok': health.ok ? '' : undefined, 'data-bad': health.ok ? undefined : '' }, health.ok ? '引擎可用' : '引擎不可用'),
            h('span', { 'data-xhs-chip': '' }, health.engine || cfg.engine || '-'),
            h('span', { 'data-xhs-chip': '', 'data-ok': login.loggedIn ? '' : undefined, 'data-bad': login.loggedIn ? undefined : '' }, login.loggedIn ? '已登录' : '未登录')),
          health.error ? h('div', { 'data-xhs-bad': '' }, health.error) : null,
          h('div', { 'data-xhs-row': '' },
            h('button', { 'data-xhs-btn': '', 'data-primary': '', disabled: busy === 'qr', onClick: loginQr }, busy === 'qr' ? '获取中…' : '扫码登录'),
            cfg.engine === 'mock' ? h('button', { 'data-xhs-btn': '', disabled: busy === 'mock', onClick: mockLogin }, 'Mock 登录') : null,
            h('button', { 'data-xhs-btn': '', onClick: refreshStatus }, '刷新状态'),
            h('div', { 'data-xhs-grow': '' }),
            cfg.paused
              ? h('button', { 'data-xhs-btn': '', 'data-primary': '', disabled: busy === 'resume', onClick: resume }, '恢复外发')
              : h('button', { 'data-xhs-btn': '', disabled: busy === 'kill', onClick: kill }, 'Kill Switch 暂停')),
          qr ? h('div', { 'data-xhs-row': '' }, h('div', { 'data-xhs-qr': '' }, h('img', { src: qr, alt: '登录二维码' })), h('div', { 'data-xhs-note': '' }, '用小红书 App 扫码登录。扫码后引擎会保存登录态；插件不保存 cookie。')) : null,
          h('div', { 'data-xhs-note': '' }, `AI 标识：${cfg.aiDisclosure || '-'} · 默认可见范围：${cfg.publishVisibility || '-'}`)),
        h('div', { 'data-xhs-sec': '' },
          h('div', { 'data-xhs-h': '' }, '下一步'),
          h('div', { 'data-xhs-note': '' }, '先在「草稿」创建/生成内容，检查合规，生成发布审批；在「审批」里人工通过后才会调用平台发布。'),
          h('div', { 'data-xhs-row': '' },
            h('span', { 'data-xhs-chip': '' }, `今日发布上限 ${cfg.dailyPostLimit ?? '-'}`),
            h('span', { 'data-xhs-chip': '' }, `今日回复上限 ${cfg.dailyReplyLimit ?? '-'}`),
            h('span', { 'data-xhs-chip': '' }, `审批有效期 ${cfg.approvalTtlHours ?? '-'}h`))),
        h('div', { 'data-xhs-sec': '' },
          h('div', { 'data-xhs-h': '' }, '安全边界'),
          h('div', { 'data-xhs-note': '' }, '所有外发都需要 approvalId + confirm=true；结果不确定时不会自动重试。默认 mock 引擎不会访问真实小红书。')))
    }

    function Drafts({ drafts, busy, run, refreshDrafts }) {
      const [form, setForm] = useState({ title: '', body: '', tags: '', images: '', topic: '' })
      const create = () => run('create', () => jpost('/drafts', {
        title: form.title,
        body: form.body,
        tags: form.tags.split(/[,，\s]+/).filter(Boolean),
        images: form.images.split(/\r?\n/).filter(Boolean),
        topic: form.topic,
      })).then((r) => { if (r?.ok !== false) setForm({ title: '', body: '', tags: '', images: '', topic: '' }) })
      return h('div', { 'data-xhs-col': '' },
        h('div', { 'data-xhs-sec': '' },
          h('div', { 'data-xhs-h': '' }, '新建草稿'),
          h('input', { 'data-xhs-input': '', placeholder: '标题（<=20 字）', value: form.title, onChange: (e) => setForm({ ...form, title: e.target.value }) }),
          h('textarea', { 'data-xhs-area': '', placeholder: '正文（<=1000 字）', value: form.body, onChange: (e) => setForm({ ...form, body: e.target.value }) }),
          h('input', { 'data-xhs-input': '', placeholder: '标签，用逗号分隔（5-8 个）', value: form.tags, onChange: (e) => setForm({ ...form, tags: e.target.value }) }),
          h('textarea', { 'data-xhs-area': '', style: { minHeight: '64px' }, placeholder: '图片路径/URL，每行一个（至少 1 张）', value: form.images, onChange: (e) => setForm({ ...form, images: e.target.value }) }),
          h('div', { 'data-xhs-row': '' },
            h('button', { 'data-xhs-btn': '', 'data-primary': '', disabled: busy === 'create', onClick: create }, '保存草稿'),
            h('button', { 'data-xhs-btn': '', onClick: refreshDrafts }, '刷新'))),
        ...drafts.map((d) => h(DraftCard, { key: d.id, draft: d, busy, run })))
    }

    function DraftCard({ draft, busy, run }) {
      const compliance = () => run('check-' + draft.id, () => jpost(`/drafts/${encodeURIComponent(draft.id)}/compliance`, {}))
      const prepare = () => run('prep-' + draft.id, () => jpost('/publish/prepare', { draftId: draft.id }))
      const c = draft.compliance
      return h('div', { 'data-xhs-card': '' },
        h('div', { 'data-xhs-row': '' }, h('b', {}, draft.title || '(无标题)'), h('span', { 'data-xhs-chip': '' }, draft.status), h('div', { 'data-xhs-grow': '' })),
        h('div', { 'data-xhs-meta': '' }, `标签 ${(draft.tags || []).join(' / ') || '-'} · 图片 ${(draft.images || []).length}`),
        h('div', { 'data-xhs-pre': '' }, String(draft.body || '').slice(0, 320)),
        c ? h('div', { 'data-xhs-note': '' }, `${c.ok ? '合规通过' : '合规未通过'}${c.issues?.length ? ' · ' + c.issues.join('；') : ''}${c.warnings?.length ? ' · 提醒：' + c.warnings.join('；') : ''}`) : null,
        h('div', { 'data-xhs-row': '' },
          h('button', { 'data-xhs-btn': '', disabled: Boolean(busy), onClick: compliance }, '合规检查'),
          h('button', { 'data-xhs-btn': '', 'data-primary': '', disabled: Boolean(busy), onClick: prepare }, '生成发布审批'),
          h('div', { 'data-xhs-grow': '' }),
          h('span', { 'data-xhs-note': '' }, '生成审批后，去「审批」通过；真正发布还要再确认。')))
    }

    function Approvals({ approvals, busy, run, refreshApprovals }) {
      return h('div', { 'data-xhs-col': '' },
        ...approvals.map((a) => h(ApprovalCard, { key: a.id, approval: a, busy, run, refreshApprovals })),
        !approvals.length ? h('div', { 'data-xhs-note': '' }, '没有审批单。先在「草稿」生成发布审批，或在「评论」生成回复审批。') : null)
    }

    function ApprovalCard({ approval, busy, run, refreshApprovals }) {
      const [confirm, setConfirm] = useState(false)
      const isPublish = approval.action === 'publish'
      const approve = () => run('approve-' + approval.id, () => jpost(`/approvals/${encodeURIComponent(approval.id)}/approve`, {}))
      const reject = () => run('reject-' + approval.id, () => jpost(`/approvals/${encodeURIComponent(approval.id)}/reject`, { reason: 'manual reject' }))
      const commit = () => {
        if (!confirm) { setConfirm(true); return }
        const body = isPublish
          ? { approvalId: approval.id, draftId: approval.targetId, confirm: true }
          : { approvalId: approval.id, confirm: true }
        return run('commit-' + approval.id, () => jpost(isPublish ? '/publish/commit' : '/reply/commit', body))
      }
      return h('div', { 'data-xhs-card': '' },
        h('div', { 'data-xhs-row': '' }, h('b', {}, `${isPublish ? '发布' : '回复'} · ${approval.summary || approval.id}`), h('span', { 'data-xhs-chip': '', 'data-warn': approval.status === 'pending' ? '' : undefined, 'data-ok': approval.status === 'approved' ? '' : undefined }, approval.status), h('div', { 'data-xhs-grow': '' })),
        h('div', { 'data-xhs-meta': '' }, `审批 ${approval.id} · 目标 ${approval.targetId} · 过期 ${approval.expiresAt || '-'}`),
        approval.preview ? h('div', { 'data-xhs-pre': '' }, JSON.stringify(approval.preview, null, 2).slice(0, 1200)) : null,
        h('div', { 'data-xhs-row': '' },
          approval.status === 'pending' ? h('button', { 'data-xhs-btn': '', 'data-primary': '', disabled: Boolean(busy), onClick: approve }, '通过') : null,
          approval.status === 'pending' ? h('button', { 'data-xhs-btn': '', disabled: Boolean(busy), onClick: reject }, '打回') : null,
          approval.status === 'approved' ? h('button', { 'data-xhs-btn': '', 'data-primary': '', disabled: Boolean(busy), onClick: commit }, confirm ? `再次点击确认${isPublish ? '发布' : '回复'}` : (isPublish ? '确认发布' : '确认回复')) : null,
          h('div', { 'data-xhs-grow': '' }),
          h('button', { 'data-xhs-btn': '', onClick: refreshApprovals }, '刷新')),
        confirm ? h('div', { 'data-xhs-warn': '' }, '这是真实外发动作。再次点击确认按钮才会执行；结果不确定时不会自动重试。') : null)
    }

    function Inbox({ posts, comments, setComments, busy, run, refreshPosts }) {
      const [postId, setPostId] = useState('')
      const [feedId, setFeedId] = useState('')
      const [xsecToken, setXsecToken] = useState('')
      const [text, setText] = useState('')
      const [commentId, setCommentId] = useState('')
      const sync = () => run('sync', async () => {
        const r = await jpost('/inbox/sync', { postId, feedId, xsecToken })
        if (r.ok !== false) {
          setComments(Array.isArray(r.comments) ? r.comments : [])
          await refreshPosts()
        }
        return r
      })
      const prepare = () => run('reply-prepare', () => jpost('/reply/prepare', { commentId, content: text }))
      useEffect(() => {
        if (!postId) {
          setComments([])
          return
        }
        let live = true
        jget('/inbox?postId=' + encodeURIComponent(postId)).then((r) => {
          if (live && r.ok !== false) setComments(asList(r, 'comments'))
        })
        return () => { live = false }
      }, [postId])
      const cards = comments.map((c) => {
        const editing = commentId === c.id
        return h('div', { key: c.id, 'data-xhs-card': '' },
          h('div', { 'data-xhs-row': '' },
            h('b', {}, `@${c.author || '用户'}`),
            h('span', { 'data-xhs-chip': '' }, c.category || '未分类'),
            h('div', { 'data-xhs-grow': '' }),
            h('span', { 'data-xhs-meta': '' }, c.status)),
          h('div', { 'data-xhs-pre': '' }, c.text),
          h('div', { 'data-xhs-row': '' },
            h('button', { 'data-xhs-btn': '', onClick: () => { setCommentId(c.id); setText('') } }, '回复这条'),
            editing ? h('input', { 'data-xhs-input': '', style: { maxWidth: '520px' }, placeholder: '回复内容（<=500 字）', value: text, onChange: (e) => setText(e.target.value) }) : null,
            editing ? h('button', { 'data-xhs-btn': '', 'data-primary': '', disabled: !text.trim() || Boolean(busy), onClick: prepare }, '生成回复审批') : null))
      })
      return h('div', { 'data-xhs-col': '' },
        h('div', { 'data-xhs-sec': '' },
          h('div', { 'data-xhs-h': '' }, '同步评论'),
          h('div', { 'data-xhs-row': '' },
            h('select', { 'data-xhs-input': '', style: { maxWidth: '420px' }, value: postId, onChange: (e) => setPostId(e.target.value) },
              h('option', { value: '' }, '选择本地发布记录'),
              ...posts.map((p) => h('option', { key: p.id, value: p.id }, `${p.title || p.xhsNoteId || p.id} · ${p.xhsNoteId || '无 noteId'}`))),
            h('button', { 'data-xhs-btn': '', 'data-primary': '', disabled: (!postId && !(feedId && xsecToken)) || Boolean(busy), onClick: sync }, '同步评论')),
          h('div', { 'data-xhs-row': '' },
            h('input', { 'data-xhs-input': '', style: { maxWidth: '300px' }, placeholder: '或手动填 noteId', value: feedId, onChange: (e) => setFeedId(e.target.value) }),
            h('input', { 'data-xhs-input': '', style: { maxWidth: '300px' }, placeholder: '或手动填 xsec_token', value: xsecToken, onChange: (e) => setXsecToken(e.target.value) })),
          h('div', { 'data-xhs-note': '' }, '只同步自己笔记的评论；不会自动回复，也不会主动评论陌生人。')),
        ...cards,
        comments.length ? null : h('div', { 'data-xhs-note': '' }, '选择一条发布记录并同步评论。'))
    }

    function Settings({ status, busy, run }) {
      const cfg = status?.config
      const [form, setForm] = useState(null)
      useEffect(() => {
        if (!cfg) return
        setForm((prev) => prev || { ...cfg, contentPillarsText: (cfg.contentPillars || []).join('\n'), bannedWordsText: (cfg.bannedWords || []).join(',') })
      }, [cfg])
      if (!cfg || !form) return h('div', { 'data-xhs-note': '' }, '读取设置…')
      const save = () => {
        const bannedWords = String(form.bannedWordsText || '').split(/[,，\s]+/).filter(Boolean)
        const payload = {
          engine: form.engine,
          engineBinary: form.engineBinary,
          enginePort: Number(form.enginePort) || 18060,
          engineHome: form.engineHome,
          cookiesPath: form.cookiesPath,
          publishVisibility: form.publishVisibility,
          dailyPostLimit: Number(form.dailyPostLimit) || 0,
          dailyReplyLimit: Number(form.dailyReplyLimit) || 0,
          approvalTtlHours: Number(form.approvalTtlHours) || 24,
          aiDisclosure: form.aiDisclosure,
          contentPillars: String(form.contentPillarsText || '').split(/\r?\n/).filter(Boolean),
        }
        if (bannedWords.length) payload.bannedWords = bannedWords
        return run('save', () => jpost('/config', payload))
      }
      return h('div', { 'data-xhs-col': '' },
        h('div', { 'data-xhs-sec': '' },
          h('div', { 'data-xhs-h': '' }, '引擎'),
          h('div', { 'data-xhs-row': '' },
            h('span', {}, '引擎'), h('select', { 'data-xhs-input': '', style: { maxWidth: '160px' }, value: form.engine, onChange: (e) => setForm({ ...form, engine: e.target.value }) },
              h('option', { value: 'mock' }, 'mock（不访问平台）'),
              h('option', { value: 'mcp' }, 'mcp（xiaohongshu-mcp）'))),
          h('div', { 'data-xhs-row': '' }, h('span', {}, '二进制路径'), h('input', { 'data-xhs-input': '', placeholder: '留空则用插件 bin/xiaohongshu-mcp.exe', value: form.engineBinary, onChange: (e) => setForm({ ...form, engineBinary: e.target.value }) })),
          h('div', { 'data-xhs-row': '' }, h('span', {}, '端口'), h('input', { 'data-xhs-input': '', type: 'number', value: form.enginePort, onChange: (e) => setForm({ ...form, enginePort: e.target.value }) })),
          h('div', { 'data-xhs-row': '' }, h('span', {}, '引擎隔离目录'), h('input', { 'data-xhs-input': '', placeholder: '例如 D:\\...\\plugins\\dsh-xhs-fish\\.xhs-home', value: form.engineHome, onChange: (e) => setForm({ ...form, engineHome: e.target.value }) })),
          h('div', { 'data-xhs-row': '' }, h('span', {}, 'Cookie 文件'), h('input', { 'data-xhs-input': '', placeholder: '例如 D:\\path\\to\\plugins\\dsh-xhs-fish\\cookies.json', value: form.cookiesPath, onChange: (e) => setForm({ ...form, cookiesPath: e.target.value }) })),
          h('div', { 'data-xhs-note': '' }, '切换引擎后下一次工具调用会重建适配器；真实引擎需要先安装 xiaohongshu-mcp。engineHome 会隔离 LOCALAPPDATA/TEMP，cookiesPath 会通过 COOKIES_PATH 传给 sidecar。')),
        h('div', { 'data-xhs-sec': '' },
          h('div', { 'data-xhs-h': '' }, '发布与合规'),
          h('div', { 'data-xhs-row': '' }, h('span', {}, '默认可见范围'), h('select', { 'data-xhs-input': '', style: { maxWidth: '200px' }, value: form.publishVisibility, onChange: (e) => setForm({ ...form, publishVisibility: e.target.value }) },
            h('option', { value: '仅自己可见' }, '仅自己可见'), h('option', { value: '公开可见' }, '公开可见'), h('option', { value: '仅互关好友可见' }, '仅互关好友可见'))),
          h('div', { 'data-xhs-row': '' }, h('span', {}, '每日发布上限'), h('input', { 'data-xhs-input': '', type: 'number', value: form.dailyPostLimit, onChange: (e) => setForm({ ...form, dailyPostLimit: e.target.value }) }), h('span', {}, '每日回复上限'), h('input', { 'data-xhs-input': '', type: 'number', value: form.dailyReplyLimit, onChange: (e) => setForm({ ...form, dailyReplyLimit: e.target.value }) })),
          h('div', { 'data-xhs-row': '' }, h('span', {}, '审批有效期(h)'), h('input', { 'data-xhs-input': '', type: 'number', value: form.approvalTtlHours, onChange: (e) => setForm({ ...form, approvalTtlHours: e.target.value }) })),
          h('div', { 'data-xhs-row': '' }, h('span', {}, 'AI 标识'), h('input', { 'data-xhs-input': '', value: form.aiDisclosure, onChange: (e) => setForm({ ...form, aiDisclosure: e.target.value }) }))),
        h('div', { 'data-xhs-sec': '' },
          h('div', { 'data-xhs-h': '' }, '内容栏目（每行一个）'),
          h('textarea', { 'data-xhs-area': '', value: form.contentPillarsText, onChange: (e) => setForm({ ...form, contentPillarsText: e.target.value }) }),
          h('div', { 'data-xhs-h': '' }, '违禁/高风险词（逗号分隔）'),
          h('input', { 'data-xhs-input': '', value: form.bannedWordsText, onChange: (e) => setForm({ ...form, bannedWordsText: e.target.value }) })),
        h('div', { 'data-xhs-row': '' }, h('button', { 'data-xhs-btn': '', 'data-primary': '', disabled: busy === 'save', onClick: save }, '保存设置')))
    }

    function Audit({ audit, refreshAudit }) {
      return h('div', { 'data-xhs-sec': '' },
        h('div', { 'data-xhs-row': '' }, h('div', { 'data-xhs-h': '' }, '运行日志'), h('div', { 'data-xhs-grow': '' }), h('button', { 'data-xhs-btn': '', onClick: refreshAudit }, '刷新')),
        h('div', { 'data-xhs-pre': '' }, audit.map((e) => `${e.ts}  ${e.action}  ${e.target || ''}  ${e.code || ''}`).join('\n') || '（空）'))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const style = document.createElement('style')
        style.setAttribute('data-plugin-css', 'dsh-xhs-fish')
        style.textContent = CSS
        document.head.appendChild(style)
        ctx.effect(() => () => style.remove(), 'xhs-fish: style')
        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!slots) return
        try {
          slots.inject('conversation.view', () => slots.register({
            name: 'conversation.view',
            id: 'xhs-fish',
            order: 31,
            label: '小红书工作台',
            scope: 'session',
          }, (props) => h(Shell, props)))
        } catch (error) {
          console.warn('[xhs-fish] conversation.view 注册失败', error)
        }
      },
    }
  },
})
