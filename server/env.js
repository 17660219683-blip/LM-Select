/**
 * 统一在这里加载 server/.env。
 *
 * 单独抽出来是因为 db.js 和 routes/compare.js 都要读环境变量，
 * 各自 loadEnvFile 会出现"谁先被 import 谁才生效"的顺序陷阱。
 * 需要环境变量的模块 import 这个文件即可。
 *
 * Node 21.7+ 内置 process.loadEnvFile，不必额外装 dotenv。
 * 没有 .env 文件属于正常情况（比如部署时用真实环境变量），静默跳过。
 */
import { fileURLToPath } from 'node:url'

try {
  process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)))
} catch {
  /* 忽略 */
}
