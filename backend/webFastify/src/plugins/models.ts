/**
 * User 模型，对应数据库中的 users 表。
 *
 * 表结构（MySQL）：
 * - id          INT 自增主键
 * - username    VARCHAR(50)  用户名
 * - password    VARCHAR(255) 密码（存 bcrypt 哈希值）
 * - name        VARCHAR(50)  姓名
 * - email       VARCHAR(100) 邮箱
 * - phone       VARCHAR(20)  电话号码（可空）
 * - gender      ENUM('male','female','other') 性别（可空）
 * - grade       VARCHAR(20)  年级（可空）
 * - birthday    DATE 出生日期（可空）
 * - token       VARCHAR(500) 当前有效的 JWT 令牌（登出后清空，可空）
 * - created_at  DATETIME 创建时间（Sequelize 自动维护）
 * - updated_at  DATETIME 更新时间（Sequelize 自动维护）
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from './db.js';

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: CreationOptional<number>;
  declare username: string;
  declare password: string;
  declare name: string;
  declare email: string;
  declare phone: string | null;
  declare gender: 'male' | 'female' | 'other' | null;
  declare grade: string | null;
  // DATEONLY 列，Sequelize 返回 'YYYY-MM-DD' 字符串。
  declare birthday: string | null;
  declare token: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: '用户名',
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: '密码（建议存 bcrypt 哈希值，不要存明文）',
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '姓名',
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '邮箱',
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '电话号码',
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: true,
      comment: '性别',
    },
    grade: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '年级',
    },
    birthday: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: '出生日期（仅年月日）',
    },
    token: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '当前有效的 JWT 令牌（登出后清空）',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '创建时间（Sequelize 自动维护）',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    timestamps: true,
  },
);

export default User;
