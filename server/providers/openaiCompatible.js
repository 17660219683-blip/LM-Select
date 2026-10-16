/**
 * OpenAI 兼容格式的厂商适配器工厂。
 *
 * DeepSeek、月之暗面、豆包、OpenAI 的接口都是同一套
 * （POST /chat/completions + Bearer 鉴权 + SSE 流），
 * 差别只在 baseUrl 和 key 的环境变量名，所以用一个工厂生成，不必写四遍。
 *
 * Anthropic、Google、TypeSafe 各有自己的协议，需要单独写适配器，
 * 但对外暴露的接口保持一致（见 index.js 的约定）。
 */

/**
 * @param {object} config
 * @param {string} config.code        厂商 code，对应数据库 vendor.code
 * @param {string} config.label       展示名
 * @param {string} [config.baseUrl]   默认 API 根地址。
 *                                    留空表示"没有可靠的默认值"，此时必须靠
 *                                    baseUrlEnv 提供 —— 见下面 Anthropic 的说明。
 * @param {string} [config.baseUrlEnv] 覆盖 baseUrl 的环境变量名
 * @param {string} config.apiKeyEnv   存放 key 的环境变量名
 * @param {string} [config.noBaseUrlHint] 没配 baseUrl 时给用户看的说明
 */
export function createOpenAiCompatible({
  code,
  label,
  baseUrl,
  baseUrlEnv,
  apiKeyEnv,
  noBaseUrlHint,
}) {
  /*
    每次调用现取，不缓存在闭包里。
    这样改完 .env 重启即生效，也不会出现"启动时读一次、之后一直用旧值"的问题。
  */
  function resolveBaseUrl() {
    const fromEnv = baseUrlEnv ? process.env[baseUrlEnv] : ''
    return String(fromEnv || baseUrl || '')
      .trim()
      .replace(/\/+$/, '')
  }

  return {
    code,
    label,
    apiKeyEnv,
    /** 协议标识，前端可按它决定附件怎么传（图片走 image_url 等） */
    protocol: 'openai',

    isConfigured() {
      return Boolean(process.env[apiKeyEnv]) && Boolean(resolveBaseUrl())
    },

    /**
     * 给前端看的提示，避免把"没配 key"说成"调用失败"。
     * 接入地址缺失时也要说清楚 —— 那种情况下光提示"没配 key"
     * 会让人去翻一个根本不是问题的地方。
     */
    missingKeyHint() {
      if (!resolveBaseUrl()) {
        return noBaseUrlHint ?? `未配置 ${label} 的接入地址（${baseUrlEnv}）。`
      }
      return `未配置 ${label} 的 API key。请在 server/.env 里设置 ${apiKeyEnv} 后重启服务。`
    },

    /**
     * 发起一次流式对话，返回上游的 Response（SSE）。
     * 不在这里解析 —— 交给路由层原样透传给浏览器，
     * 前端用已有的 services/sse.js 解析，避免两边各写一套。
     *
     * @param {object} p
     * @param {string} p.apiModelId 厂商真实模型名（数据库 model_version.api_model_id）
     * @param {Array<{role:string,content:string}>} p.messages
     * @param {AbortSignal} p.signal
     * @param {Array} [p.tools] 工具定义（OpenAI 格式）。
     *                          只有 agent 场景会传；不传时请求体与原行为完全一致，
     *                          对话页与对比测试页都不受影响。
     */
    chat({ apiModelId, messages, signal, tools }) {
      const key = process.env[apiKeyEnv]

      return fetch(`${resolveBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        signal,
        body: JSON.stringify({
          model: apiModelId,
          messages,
          stream: true,
          /*
            要求最后一帧带上 usage。
            没有它就拿不到 token 用量，而 token 用量是成本对比的核心指标。
            OpenAI 兼容的厂商不一定都实现，拿不到时前端指标会显示为「—」。
          */
          stream_options: { include_usage: true },
          ...(tools?.length ? { tools, tool_choice: 'auto' } : {}),
        }),
      })
    },
  }
}
