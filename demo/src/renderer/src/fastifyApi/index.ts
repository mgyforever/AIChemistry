export class FastifyApi {
  // 开发环境由 Vite 代理到 http://localhost:3000/chemistry
  public baseUrl = '/chemistry'
  public registerUrl = '/auth/register'
  public loginUrl = '/auth/login'
}
