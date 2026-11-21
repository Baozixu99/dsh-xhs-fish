import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ApprovalService } from './lib/approval.js'
import { dataDirOf, loadConfig, saveConfig } from './lib/config.js'
import { EngineManager } from './lib/engine-manager.js'
import { createHttpHandler } from './lib/http.js'
import { XhsService } from './lib/service.js'
import { Store } from './lib/store.js'
import { registerTools } from './lib/tools.js'

export const name = 'xhs-fish'
export const inject = ['webServer', 'tools']

const pluginDir = dirname(fileURLToPath(import.meta.url))

/**
 * 小红书 AI 主理人工作台（DSH host 半端）。
 *
 * 安全边界：
 * - 默认 mock 引擎，不访问真实小红书。
 * - 发布/回复都需要 approvalId + confirm=true。
 * - 发布/回复结果不确定时不重试。
 * - Kill Switch 可暂停所有外发。
 */
export function apply(ctx, config = {}) {
  const dataDir = dataDirOf()
  const store = new Store(dataDir)
  let cfg = loadConfig(dataDir)
  const logger = ctx.logger || console

  const getConfig = () => {
    cfg = loadConfig(dataDir)
    return cfg
  }
  const persistConfig = (patch) => {
    cfg = saveConfig(dataDir, patch)
    store.reloadConfig()
    return cfg
  }

  const engineManager = new EngineManager({ dataDir, pluginDir, getConfig, logger })
  const approval = new ApprovalService(store, cfg)
  const service = new XhsService({
    store,
    approval,
    engineManager,
    getConfig,
    saveConfig: persistConfig,
    logger,
  })

  if (config && config.enabled === false) {
    logger.info?.('[xhs-fish] plugin disabled by config')
    return
  }

  registerTools(ctx, service)

  ctx.effect(
    () => () => engineManager.close(),
    'xhs-fish: engine lifecycle',
  )

  ctx.effect(
    () => ctx.webServer.register({
      kind: 'prefix',
      path: '/api/xhs-fish',
      handler: createHttpHandler(service),
    }),
    'xhs-fish: HTTP API',
  )

  logger.info?.(`[xhs-fish] ready · data=${dataDir} · engine=${cfg.engine} · paused=${cfg.paused}`)
  logger.info?.('[xhs-fish] 默认 mock 引擎；设置 engine=mcp 并配置 engineBinary 后才连接真实小红书。')
  logger.info?.(`[xhs-fish] 所有发布/回复必须经人工审批；没有 approvalId + confirm=true 不会外发。`)
}
