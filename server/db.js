/**
 * MySQL 连接池。
 *
 * 配置优先从 server/.env 读，其次环境变量，最后是本地默认值。
 * .env 的加载统一交给 env.js，避免多个模块各加载一次时的顺序问题。
 */
import mysql from 'mysql2/promise'

import './env.js'

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'lm_select',

  /*
    下面三个参数都是踩过坑才加的，别删：

    charset=utf8mb4
      不设的话中文和 emoji 会乱码。模型名、厂商名、人群描述全是中文。

    dateStrings: ['DATE']
      DATE 列默认会变成 JS Date 对象，再经时区换算就少一天。
      模型发布日期集体早一天，在「按时间筛选」时会直接给出错误结果。

    decimalNumbers: true
      DECIMAL 默认返回字符串（这是 MySQL 驱动防精度丢失的设计）。
      价格数值都很小且只用于展示与排序，转成数字前端直接用。
  */
  charset: 'utf8mb4',
  dateStrings: ['DATE'],
  decimalNumbers: true,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

/** 供启动时探活用：能查通就说明库和账号都没问题 */
export async function ping() {
  const conn = await pool.getConnection()
  try {
    await conn.query('SELECT 1')
  } finally {
    conn.release()
  }
}
