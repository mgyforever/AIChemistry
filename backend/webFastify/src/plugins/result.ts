/**
 * 统一接口响应模板。
 *
 * 所有接口（成功或失败）的响应体均采用该结构：
 * {
 *   status: 'ok' | 'error',   // 请求是否成功
 *   message: string,          // 提示信息
 *   data: T | null,           // 业务数据，无数据时为 null
 * }
 *
 * 由 src/plugins/response.ts 自动将各接口响应包装为该格式；
 * 处理器中也可直接返回 new Result(...) 自定义内容。
 */
export class Result<T = null> {
  readonly status: 'ok' | 'error';
  readonly message: string;
  readonly data: T | null;

  constructor(status: 'ok' | 'error', message: string, data?: T | null) {
    this.status = status;
    this.message = message;
    // 未传 data 时序列化为 null，避免出现 undefined（JSON 无法表示）
    this.data = data === undefined ? null : data;
  }

  /** 构造成功响应。 */
  static ok<T>(data?: T | null, message = 'success'): Result<T> {
    return new Result('ok', message, data);
  }

  /** 构造失败响应。 */
  static error(message: string): Result<null> {
    return new Result('error', message, null);
  }
}

export default Result;
