# LM Select

**大语言模型与智能体选型推荐系统**

把散落在各家官网、定价页、榜单里的模型与 Agent 信息，整理成一套结构化、可筛选、可对比、可溯源的知识库，并在其上给出**能逐条讲清理由**的选型推荐结论。

- 当前版本：**1.0.0**
- 完整功能说明见 `../docs/产品文档-LM Select-v1.0.0.md`

---

## 核心主张

1. **可信性标注优先于数据完整性。** 能力项四态：支持 / 部分支持 / 不支持 / **未采集**。「没查过」必须长得像「没查过」。
2. **缺数据就弃权，不用 0 分冒充。** 无数据的维度不参与加权，权重在剩余维度重新归一，并在页面上明说。
3. **结论必须可溯源。** 每条能力状态都带来源、核查日期、置信度，界面上可点开查看证据链。
4. **API Key 永不下发前端。** 所有模型调用都在服务端完成。

---

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Vue 3.5 + Pinia 4 + Vue Router 5 + Vite 8 |
| 后端 | Node.js + Express 5（ESM） |
| 数据库 | MySQL 8（`lm_select`，25 张表） |
| 鉴权 | httpOnly Cookie + 手写 HS256 JWT + scrypt（**零第三方依赖**，全用 `node:crypto`） |
| 附件解析 | `pdfjs-dist` + `mammoth`（PDF / DOCX / TXT / MD，含 GBK 识别） |

运行环境：Node.js `^22.18.0 || >=24.12.0`

---

## 页面一览

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/` | 对话 | 流式对话、多会话、思考过程面板 |
| `/models` | 模型库 | 46 款模型多维筛选、比价、详情可溯源 |
| `/compare` | 对比测试 | 2~4 款模型并发流式对比，指标同屏 |
| `/agent` | Agent | 三款 Agent 界面复刻件（可真实对话） |
| `/agent/spec` | Agent 规格 | 8 款产品 × 25 能力维度的四态矩阵 |
| `/recommend` | 推荐 | 11 类人群 → 门槛过滤 → 加权打分 |
| `/login` | 登录 / 注册 | 注册需管理员审核 |
| `/admin/users` | 账号审核 | 仅管理员：审核、启停、改角色、重置密码 |
| `/logs` | 日志管理 | 规划中（占位页） |

---

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 建库 + 导入结构与种子数据（脚本在上级目录的 db/ 里）
cd ..
mysql -u root -p --default-character-set=utf8mb4 < db/schema_v1.sql
for f in db/migration_*.sql db/seed_data_*.sql; do
  mysql -u root -p --default-character-set=utf8mb4 < "$f"
done
cd "LM Select"

# 3. 配置后端环境变量（数据库账号、模型密钥、鉴权密钥）
#    编辑 server/.env

# 4. 启动（前后端一起）
npm run dev:all
```

前端 <http://127.0.0.1:5173>，后端 <http://127.0.0.1:3001>。

### 初始账号

| 账号 | 密码 | 角色 / 状态 |
| --- | --- | --- |
| `admin` | `lmselect2026` | 管理员，已激活 |
| `demo` | `demo2026abc` | 普通用户，已激活 |
| `waiting` | `wait2026abc` | 待审核（用于演示审核流程） |

> 正式部署前请删除登录页的演示账号提示块并修改以上密码。

---

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev:all` | 前后端一起启 |
| `npm run dev` | 只启前端 |
| `npm run server` | 只启后端（`--watch`） |
| `npm run build` | 前端生产构建 |
| `npm run lint` | oxlint + eslint（含自动修复） |
| `npm run format` | prettier 格式化 |

---

## 目录结构

```
LM Select/
├── src/
│   ├── views/          # 9 个页面
│   ├── components/     # 按页面分子目录
│   ├── stores/         # Pinia：auth / chat / compare / trialChat
│   ├── services/       # 接口封装层
│   ├── router/         # 路由与鉴权守卫
│   └── utils/          # 纯函数工具
└── server/
    ├── routes/         # 7 个业务路由
    ├── auth/           # 鉴权基础设施（哈希 / JWT / Cookie / 中间件）
    ├── providers/      # 厂商适配器注册表（5 家）
    ├── agent/          # Agent 运行内核（预设 / 工具 / 沙箱 / 循环）
    ├── sessions/       # 会话 JSON 存储（运行时数据）
    └── index.js        # 服务入口
```

数据库脚本在 `../db/`，项目文档与素材在 `../docs/`。
