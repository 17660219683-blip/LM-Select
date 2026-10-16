/**
 * 全局配置。换模型、换地址、改人设，只动这一个文件。
 */

/**
 * 后端服务地址（server/index.js）。走 Vite 代理，没有跨域问题。
 * 会话存储和模型库共用这一个 Express 服务，只是路由前缀不同（/api/sessions 与 /api/models）。
 */
export const API_BASE = '/api'

/** 旧名，等同 API_BASE，保留是为了不改动已有引用 */
export const SESSION_API_BASE = API_BASE

/**
 * 模型服务地址 —— 浏览器直连本机 Ollama 的 OpenAI 兼容接口。
 * 如果被 CORS 拦住（控制台报 CORS 或 Failed to fetch），有两个办法：
 *   1. 给 Ollama 设环境变量 OLLAMA_ORIGINS=* 后重启它；
 *   2. 把下面这行改成 '/model'，然后在 vite.config.js 里加
 *      '/model': { target: 'http://127.0.0.1:11434', changeOrigin: true, rewrite: p => p.replace(/^\/model/, '') }
 */
export const MODEL_BASE_URL = 'http://127.0.0.1:11434/v1'
export const MODEL_NAME = 'deepseek-r1:8b'

/**
 * 人设常量。
 * 原 Streamlit 版本里这两个值由侧边栏输入框提供，现在改成常量。
 */
export const NICKNAME = 'DS'
export const CHARACTER = '高冷御姐'

/** 系统提示词，与原始 Python 版本逐字一致；两个 %s 依次填入 NICKNAME、CHARACTER */
const SYSTEM_PROMPT_TEMPLATE = `
            你是%s，风格专业编程助手。冷静寡言，不闲聊，语气克制简洁，不使用感叹号与可爱词汇。只处理编程相关问题。
            规则：
        1. 读懂需求，输出可运行完整代码，附带注释、依赖、运行说明。
        2. 排查bug直接定位根因，提供修复代码并简要说明。
        3. 代码评审从可读性、异常、性能、安全给出优化方案。
        4. 拒绝恶意代码，涉及密钥、数据库主动提示安全风险，不编造不存在API。
        5. 支持Python/Java/Go/JS/TS/Vue/React/SQL/Docker等，可写单元测试、文档、Mermaid图。
        无关话题简短回绝，不做多余寒暄。%s
        `

/** 等价于 Python 的 SYSTEM_PROMPT_TEMPLATE % (nickname, character) */
export function buildSystemPrompt() {
  return SYSTEM_PROMPT_TEMPLATE.replace('%s', NICKNAME).replace('%s', CHARACTER)
}
