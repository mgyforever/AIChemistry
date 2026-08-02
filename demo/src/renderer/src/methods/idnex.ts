export const methods =() => {
  /**
   * 通用认证请求函数
   * @param options.url 接口完整地址
   * @param options.method 请求方式（GET / POST / PUT / DELETE 等）
   * @param options.token 认证令牌（可选），会以 Bearer 形式放在 Authorization 请求头中
   * @param options.query URL 查询参数（可选），会自动拼接到 URL 末尾
   * @param options.body 请求体数据（可选），以 JSON 格式发送
   * @param options.headers 额外的请求头（可选），会合并到请求头中
   * @returns 后端响应的 JSON 数据
   */
  const authRequest = async (options: {
    url: string
    method: string
    token?: string
    query?: Record<string, string>
    body?: Record<string, any>
    headers?: Record<string, string>
  }): Promise<any> => {
    console.log("authRequest", options);

    const headers: Record<string, string> = { ...options.headers }
    if (options.token) {
      headers['Authorization'] = 'Bearer ' + options.token
    }

    // 将 query 参数拼接到 URL 上
    let finalUrl = options.url
    if (options.query) {
      const params = new URLSearchParams(options.query)
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + params.toString()
    }

    const requestInit: RequestInit = {
      method: options.method,
      headers,
    }

    if (options.body) {
      headers['Content-Type'] = 'application/json'
      requestInit.body = JSON.stringify(options.body)
    }

    try {
      const response = await fetch(finalUrl, requestInit)
      console.log("requestInit", requestInit);
      // console.log("response" + options.url, response);
      const responseJson = await response.json();
      console.log("response.json()" + options.url, responseJson);



      if (!response.ok) {
        throw new Error(`请求失败，HTTP 状态码: ${response.status}，响应: ${JSON.stringify(responseJson)}`)
      }

      return responseJson
    } catch (error) {
      console.error('认证请求出错:', error)
      throw error
    }
  }

  return {
    authRequest
  }

}

