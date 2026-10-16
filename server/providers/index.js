/**
 * 厂商适配器注册表。
 *
 * key 是数据库 vendor.code。要新增一家，写一个适配器再 register 即可，
 * 路由和前端都不用改。
 *
 * 适配器对外必须提供：
 *   code            厂商 code
 *   label           展示名
 *   protocol        协议标识（openai / anthropic / google / systemone）
 *   isConfigured()  接入地址和 key 是否都齐了
 *   missingKeyHint() 没配齐时给用户看的话（缺地址还是缺 key 要分清）
 *   chat({ apiModelId, messages, signal })  返回上游 Response（流式）
 */
import '../env.js'
import { createOpenAiCompatible } from './openaiCompatible.js'

const registry = new Map()

function register(adapter) {
  registry.set(adapter.code, adapter)
}

/*
  已接入的五家。

  前四家（DeepSeek / 月之暗面 / 豆包 / OpenAI）的官方接口本来就是
  OpenAI 兼容，共用同一个工厂，只是 baseUrl 不同；
  Anthropic 见下面的单独说明。

  baseUrl 一律通过 <厂商>_BASE_URL 环境变量覆盖，
  默认值写官方地址 —— 这样临时走代理或中转站时不用改代码。
*/
register(
  createOpenAiCompatible({
    code: 'deepseek',
    label: 'DeepSeek',
    baseUrlEnv: 'DEEPSEEK_BASE_URL',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
  }),
)

register(
  createOpenAiCompatible({
    code: 'moonshot',
    label: '月之暗面',
    baseUrlEnv: 'MOONSHOT_BASE_URL',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'MOONSHOT_API_KEY',
  }),
)

register(
  createOpenAiCompatible({
    code: 'bytedance',
    label: '字节跳动 豆包',
    baseUrlEnv: 'ARK_BASE_URL',
    // 火山方舟的 OpenAI 兼容入口在 /api/v3
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKeyEnv: 'ARK_API_KEY',
  }),
)

register(
  createOpenAiCompatible({
    code: 'openai',
    label: 'OpenAI',
    baseUrlEnv: 'OPENAI_BASE_URL',
    // OpenAI 官方就是 OpenAI 兼容协议，默认值可以直接用
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
  }),
)

/*
  Anthropic。

  ⚠️ 官方**刻意不给默认地址**。
  Claude 官方走的是 /v1/messages 原生协议，https://api.anthropic.com/v1
  下面根本没有 /chat/completions。要是给它填上官方地址当 OpenAI 兼容端点打，
  会得到 404，而报错信息完全看不出真正原因 —— 那种坑排查起来最费时间。

  所以这里必须由 ANTHROPIC_BASE_URL 显式指定。指向中转站（New API 一类）
  时它是 OpenAI 兼容的，能直接走通；要用官方 Claude，需要另写原生适配器
  （协议不同，返回的 SSE 结构也不一样，得在服务端转成 OpenAI 格式）。
*/
register(
  createOpenAiCompatible({
    code: 'anthropic',
    label: 'Anthropic',
    baseUrlEnv: 'ANTHROPIC_BASE_URL',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    noBaseUrlHint:
      'Anthropic 官方是 /v1/messages 原生协议，不是 OpenAI 兼容，因此没有默认接入地址。' +
      '请把 ANTHROPIC_BASE_URL 指向提供 OpenAI 兼容入口的中转站；' +
      '要用官方 Claude 则需要另接原生适配器。',
  }),
)

export function getAdapter(code) {
  return registry.get(code) ?? null
}

/** 给前端用：有哪些厂商、各自能不能跑 */
export function listAdapters() {
  return [...registry.values()].map((a) => ({
    code: a.code,
    label: a.label,
    protocol: a.protocol,
    configured: a.isConfigured(),
    missingKeyHint: a.isConfigured() ? null : a.missingKeyHint(),
  }))
}
