/**
 * Sequelize 数据库连接模块。
 *
 * 通过 dotenv 从项目根目录的 .env 文件加载连接配置，
 * 使用 Sequelize（dialect: mysql）建立连接，供模型层使用。
 */
import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

// quiet: 抑制 dotenv 17+ 在加载 .env 时输出的提示信息，保持日志干净。
dotenv.config({ quiet: true });

const database = process.env.DB_NAME ?? 'unifyData';
const username = process.env.DB_USER ?? 'root';
const password = process.env.DB_PASSWORD ?? '';
const host = process.env.DB_HOST ?? 'localhost';
const port = Number(process.env.DB_PORT ?? 3306);

export const sequelize = new Sequelize(database, username, password, {
  host,
  port,
  dialect: 'mysql',
  logging: false,
  define: {
    // 数据库字段使用下划线命名，Sequelize 自动将 createdAt/updatedAt
    // 映射到 created_at/updated_at 列。
    underscored: true,
    timestamps: true,
  },
  pool: {
    max: 10,
    min: 0,
    idle: 10000,
  },
});

/**
 * 测试数据库连接。
 *
 * @returns 连接成功返回 true，失败时抛出异常。
 *
 * @example
 * await sequelize.authenticate();
 */
export const authenticate = () => sequelize.authenticate();

export default sequelize;
