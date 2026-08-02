/**
 * 认证相关接口（前缀 /auth）。
 *
 * - POST /auth/register 用户注册
 * - POST /auth/login    用户登录（签发 JWT 并写入 users.token）
 * - GET  /auth/me       获取当前登录用户信息（需认证）
 * - POST /auth/logout   退出登录（清空 users.token）
 */
import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { User } from '../plugins/models.js';

interface RegisterBody {
  username: string;
  password: string;
  name?: string;
  email?: string;
  phone?: string;
  gender?: 'male' | 'female' | 'other';
  grade?: string;
  birthday?: string;
}

interface LoginBody {
  username: string;
  password: string;
}

const registerSchema = {
  body: {
    type: 'object',
    required: ['username', 'password'],
    additionalProperties: false,
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 50 },
      password: { type: 'string', minLength: 6, maxLength: 255 },
      name: { type: 'string', maxLength: 50 },
      email: { type: 'string', format: 'email', maxLength: 100 },
      phone: { type: 'string', maxLength: 20 },
      gender: { type: 'string', enum: ['male', 'female', 'other'] },
      grade: { type: 'string', maxLength: 20 },
      birthday: { type: 'string', format: 'date' },
    },
  },
} as const;

const loginSchema = {
  body: {
    type: 'object',
    required: ['username', 'password'],
    additionalProperties: false,
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 50 },
      password: { type: 'string', maxLength: 255 },
    },
  },
} as const;

/** 剔除敏感字段（password、token）后的用户信息。 */
function publicUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    phone: user.phone,
    gender: user.gender,
    grade: user.grade,
    birthday: user.birthday,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const authRoutes: FastifyPluginAsync = async fastify => {
  // 注册
  fastify.post('/register', { schema: registerSchema }, async (request, reply) => {
    const body = request.body as RegisterBody;

    const usernameTaken = await User.findOne({ where: { username: body.username } });
    if (usernameTaken) {
      return reply.code(409).send({ message: '用户名已存在' });
    }
    // email 为非必填，仅在填写时才做唯一性检查
    if (body.email) {
      const emailTaken = await User.findOne({ where: { email: body.email } });
      if (emailTaken) {
        return reply.code(409).send({ message: '邮箱已被注册' });
      }
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await User.create({
      username: body.username,
      password: passwordHash,
      // name/email 在表中为 NOT NULL，未传时给出默认值
      name: body.name ?? body.username,
      email: body.email ?? '',
      phone: body.phone ?? null,
      gender: body.gender ?? null,
      grade: body.grade ?? null,
      birthday: body.birthday ?? null,
    });

    return reply.code(201).send({ message: '注册成功', user: publicUser(user) });
  });

  // 登录
  fastify.post('/login', { schema: loginSchema }, async (request, reply) => {
    const body = request.body as LoginBody;

    const user = await User.findOne({ where: { username: body.username } });
    if (!user) {
      return reply.code(401).send({ message: '用户名或密码错误' });
    }

    const passwordMatches = await bcrypt.compare(body.password, user.password);
    if (!passwordMatches) {
      return reply.code(401).send({ message: '用户名或密码错误' });
    }

    const token = fastify.jwt.sign({ id: user.id, username: user.username });
    user.token = token;
    await user.save();

    return { message: '登录成功', token, user: publicUser(user) };
  });

  // 当前用户信息（需认证）
  fastify.get('/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = await User.findByPk(request.user.id);
    if (!user) {
      return reply.code(404).send({ message: '用户不存在' });
    }
    return { user: publicUser(user) };
  });

  // 退出登录（需认证）
  fastify.post('/logout', { preHandler: fastify.authenticate }, async (request, reply) => {
    await User.update({ token: null }, { where: { id: request.user.id } });
    return { message: '已退出登录' };
  });
};

export default authRoutes;
