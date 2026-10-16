import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachUser } from './auth/middleware.js'
import { ping } from './db.js'
import agentRouter from './routes/agent.js'
import agentsRouter from './routes/agents.js'
import attachmentsRouter from './routes/attachments.js'
import authRouter from './routes/auth.js'
import compareRouter from './routes/compare.js'
import modelsRouter from './routes/models.js'
import recommendRouter from './routes/recommend.js'

const here = path.dirname(fileURLToPath(import.meta.url))

/** 会话 JSON 文件的存放目录，可用环境变量 SESSIONS_DIR 覆盖 */
const SESSIONS_DIR = process.env.SESSIONS_DIR
  ? path.resolve(process.env.SESSIONS_DIR)
  : path.join(here, 'sessions')

const PORT = Number(process.env.PORT) || 3001

const app = express()
app.use(express.json({ limit: '10mb' }))

/* 本地开发用：允许 Vite 开发服务器直接跨域访问（项目里也配了代理，双保险） */
app.use((req, res, next) => {
  /*
    登录态走 Cookie，所以这里**不能**再用 Access-Control-Allow-Origin: *。
    带凭证的跨域请求在规范里明确禁止通配符：浏览器见到 * 会直接拒收响应，
    而且报的错（CORS policy）跟真实原因（星号）看起来毫无关系，极易误判。

    正确做法是回显请求方 Origin，并声明 Allow-Credentials。
    开发时前端走 Vite 代理（同源），其实用不到这段；
    但直接访问 127.0.0.1:3001 或用别的端口调试时就需要它。
  */
  const origin = req.headers.origin
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    /* 回显 Origin 时必须同时声明 Vary，否则中间缓存可能把 A 站的响应发给 B 站 */
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,PATCH,POST,DELETE,OPTIONS')
  // X-File-Name 是附件解析接口带文件名用的；Authorization 留给以后可能加的非 Cookie 方案
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-File-Name,Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

/*
  账号与鉴权接口（/api/auth*）。
  登录态是一枚签在 httpOnly Cookie 里的 JWT，服务端不存会话副本。
  attachUser 只挂在这一条路由组上：它每次请求都要查一次 app_user，
  挂到全局会让所有只读接口（模型库、Agent 库）白白多一次数据库查询。
  以后如果给会话接口也加鉴权，就地再挂一次即可。
*/
app.use('/api/auth', attachUser, authRouter)

/*
  模型库接口（/api/models*）。
  读的是 MySQL 里的模型知识库，和上面基于 JSON 文件的会话存储是两套独立数据，
  只是共用这一个 HTTP 服务。
*/
app.use('/api', modelsRouter)

/*
  对比测试接口（/api/compare*）。
  目前只对接本机 Ollama，调用放在服务端是为了绕开 CORS，
  以及给以后接云厂商留位置（密钥不下发到浏览器）。
*/
app.use('/api', compareRouter)

/*
  附件解析接口（/api/attachments/parse）。
  浏览器只负责上传，抽文字这种重活放在这里做 ——
  mammoth / pdfjs 加起来近 1MB，不该塞进前端包，
  而且 Node 版是它们的原生构建，行为比浏览器版可控。
*/
app.use('/api', attachmentsRouter)

/*
  Agent 试跑接口（/api/agent/*）。
  与对比测试的区别：agent 跑的是一个过程（会调工具、可能中途要人确认），
  所以除了 SSE 推送轨迹，还需要一个反向接口接收用户的授权决定。
  产物落在 server/agent/workspace/<runId>/ 里，按运行隔离。
*/
app.use('/api', agentRouter)

/*
  Agent 产品库接口（/api/agents*）。
  和模型库共用一套 MySQL 知识库，读的是 migration_08 建的 Agent 侧 6 张表。
*/
app.use('/api', agentsRouter)

/*
  选型推荐接口（/api/recommend*）。
  同时消费两侧数据：Agent 走 agent_persona_fit 人工评估，
  模型走 hard_gates 门槛 + 加权打分，规则全在服务端、随响应返回口径说明。
*/
app.use('/api', recommendRouter)

/* 会话 ID 就是时间戳，只放行这个形状，杜绝 ../ 之类的路径穿越 */
const ID_RE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/

function fileFor(id) {
  if (!ID_RE.test(id)) return null
  return path.join(SESSIONS_DIR, `${id}.json`)
}

/**
 * 递归按键名排序。
 * 原 Python 版本用的是 json.dump(..., sort_keys=True)，那个是递归排序的，
 * 只排顶层的话嵌套的 messages 里键序会和原版不一致。
 */
function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) out[key] = sortKeysDeep(value[key])
    return out
  }
  return value
}

async function readSession(id) {
  const file = fileFor(id)
  if (!file) return null
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

/** 列表：只回摘要，不把每个会话的全部消息都塞给前端 */
app.get('/api/sessions', async (req, res, next) => {
  try {
    await fs.mkdir(SESSIONS_DIR, { recursive: true })
    const names = await fs.readdir(SESSIONS_DIR)
    const ids = names
      .filter((n) => n.endsWith('.json'))
      .map((n) => n.slice(0, -5))
      .filter((id) => ID_RE.test(id))

    const list = []
    for (const id of ids) {
      const data = await readSession(id)
      if (!data) continue
      const messages = Array.isArray(data.messages) ? data.messages : []
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      list.push({
        id,
        nickname: data.nickname ?? '',
        character: data.character ?? '',
        messageCount: messages.length,
        title: data.title ?? '',
        preview: lastUser ? String(lastUser.content).replace(/\s+/g, ' ').slice(0, 40) : '',
      })
    }

    // 会话 ID 本身是可排序的时间戳，倒序即最新在前
    list.sort((a, b) => (a.id < b.id ? 1 : -1))
    res.json(list)
  } catch (err) {
    next(err)
  }
})

app.get('/api/sessions/:id', async (req, res, next) => {
  try {
    const data = await readSession(req.params.id)
    if (!data) return res.status(404).json({ error: 'session not found' })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/** 保存（不存在就创建）。字段和键序刻意对齐原 Python 的 json.dump(sort_keys=True, indent=4) */
app.put('/api/sessions/:id', async (req, res, next) => {
  try {
    const file = fileFor(req.params.id)
    if (!file) return res.status(400).json({ error: 'invalid session id' })

    const body = req.body ?? {}
    const existing = await readSession(req.params.id)
    const payload = {
      nickname: body.nickname ?? '',
      current_session: req.params.id,
      character: body.character ?? '',
      messages: Array.isArray(body.messages) ? body.messages : [],
      /*
        title 由重命名单独维护。
        PUT 不带 title 时保留原值，否则前端每保存一条消息都会把标题冲掉。
      */
      title: typeof body.title === 'string' ? body.title.trim() : (existing?.title ?? ''),
    }

    await fs.mkdir(SESSIONS_DIR, { recursive: true })
    await fs.writeFile(file, JSON.stringify(sortKeysDeep(payload), null, 4), 'utf8')
    res.json({ ok: true, id: req.params.id })
  } catch (err) {
    next(err)
  }
})

/** 只改标题，不碰消息：避免读-改-写把正在进行的对话覆盖掉 */
app.patch('/api/sessions/:id', async (req, res, next) => {
  try {
    const file = fileFor(req.params.id)
    if (!file) return res.status(400).json({ error: 'invalid session id' })

    const existing = await readSession(req.params.id)
    if (!existing) return res.status(404).json({ error: 'session not found' })

    const title =
      typeof req.body?.title === 'string' ? req.body.title.trim() : (existing.title ?? '')

    await fs.writeFile(file, JSON.stringify(sortKeysDeep({ ...existing, title }), null, 4), 'utf8')
    res.json({ ok: true, id: req.params.id, title })
  } catch (err) {
    next(err)
  }
})

app.delete('/api/sessions/:id', async (req, res, next) => {
  try {
    const file = fileFor(req.params.id)
    if (!file) return res.status(400).json({ error: 'invalid session id' })
    await fs.rm(file, { force: true })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

app.use((err, req, res, _next) => {
  console.error('[server]', err)
  res.status(500).json({ error: err.message })
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[server] 会话存储服务已启动  http://127.0.0.1:${PORT}`)
  console.log(`[server] 会话文件目录          ${SESSIONS_DIR}`)
  console.log(`[server] 登录接口前缀          /api/auth`)

  /*
    数据库连不上只提示、不退出。
    模型库和会话是两套独立数据，数据库挂了不该把对话功能一起拖死。

    下面按错误码给出可直接照做的排查提示 —— 光看到 ECONNREFUSED
    并不能让人反应过来是"MySQL 服务没启动"。
  */
  ping()
    .then(() => console.log('[server] 模型库数据库连接正常'))
    .catch((err) => {
      console.warn(`[server] 模型库数据库连接失败：${err.message}`)

      const HINTS = {
        ECONNREFUSED: [
          '3306 端口没有服务在监听 —— MySQL 服务没启动。',
          '用【管理员权限】开一个终端执行：net start MySQL80',
          '（若装了多个实例，先确认数据库在哪个实例里，见 my.ini 的 datadir）',
        ],
        ER_ACCESS_DENIED_ERROR: [
          '账号或密码不对，检查 server/.env 里的 DB_USER / DB_PASSWORD。',
        ],
        ER_BAD_DB_ERROR: ['数据库不存在，先执行 db/schema_v1.sql 建库建表。'],
        ETIMEDOUT: ['连接超时，检查 server/.env 里的 DB_HOST / DB_PORT，以及防火墙。'],
      }

      for (const line of HINTS[err.code] ?? ['未知错误码，请检查 server/.env 与 MySQL 状态。']) {
        console.warn(`[server]   ${line}`)
      }

      console.warn('[server]   模型库接口不可用，但对话功能不受影响。')
    })
})
