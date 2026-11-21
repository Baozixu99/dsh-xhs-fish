let hostDefineTool = null
try {
  const mod = await import('@deepseek-ai/dsh-tools')
  hostDefineTool = typeof mod.defineTool === 'function' ? mod.defineTool : null
} catch {
  // 桌面版可能没有 autoInstallPeers；没有宿主实现时用本地等价转换。
}

/**
 * 优先使用宿主 @deepseek-ai/dsh-tools 的 defineTool；不可用时回退到
 * 本地 JSON Schema 转换，保证插件仍能注册工具。
 */
export function defineTool(spec) {
  if (hostDefineTool) return hostDefineTool(spec)
  return fallbackDefineTool(spec)
}

function fallbackDefineTool(spec) {
  return {
    name: spec.name,
    description: spec.description,
    parameters: compileParameters(spec.parameters || {}),
    output: {
      schema: compileValue(spec.output?.schema || { type: 'json' }),
      render: spec.output?.render || ((_args, value) => [{ type: 'text', text: stringify(value) }]),
    },
    ...(spec.timeoutMs ? { timeoutMs: spec.timeoutMs } : {}),
    async execute(args) {
      return spec.execute(args)
    },
  }
}

function compileParameters(params) {
  const properties = {}
  const required = []
  for (const [key, value] of Object.entries(params)) {
    if (!value || typeof value !== 'object') continue
    properties[key] = compileValue(value)
    if (value.required === true) required.push(key)
  }
  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties: false,
  }
}

function compileValue(spec) {
  if (!spec || typeof spec !== 'object') return {}
  if (Array.isArray(spec.oneOf)) return { oneOf: spec.oneOf.map(compileValue) }
  const out = {}
  for (const key of ['description', 'title', 'default', 'examples']) {
    if (spec[key] !== undefined) out[key] = spec[key]
  }
  if (spec.type === 'json') return out
  if (spec.type === 'object') {
    out.type = 'object'
    out.properties = compileParameters(spec.properties || {}).properties
    out.additionalProperties = spec.additionalProperties === true
    return out
  }
  if (spec.type === 'array') {
    out.type = 'array'
    if (spec.items) out.items = compileValue(spec.items)
    return out
  }
  out.type = spec.type || 'string'
  if (Array.isArray(spec.enum)) out.enum = spec.enum
  if (spec.const !== undefined) out.const = spec.const
  return out
}

function stringify(value) {
  if (typeof value === 'string') return value
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}
