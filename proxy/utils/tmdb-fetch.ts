// proxy/utils/tmdb-fetch.ts
//
// 转发 TMDB 请求的工具函数。
//
// 默认行为：完全等同上游 —— 直接用 $fetch 请求 baseURL（走系统 DNS）。
//
// 仅当设置了环境变量 TMDB_API_IP 时：改为直连该 IP。
//   * 适用于本机 DNS 把 api.themoviedb.org 解析到被污染 IP 的场景
//   * TLS 的 SNI 与证书校验仍然使用域名，安全性与正常访问一致
//     （原理等价于 curl --resolve）
//
// 用法：$env:TMDB_API_IP = '99.84.152.53' ; pnpm dev:proxy
// 不设置时，本文件的行为与上游一模一样。

import https from 'node:https'
import process from 'node:process'

interface TmdbFetchOptions {
  baseURL: string
  headers?: Record<string, string>
}

export async function tmdbFetch(
  path: string,
  params: Record<string, unknown>,
  options: TmdbFetchOptions,
): Promise<unknown> {
  const ip = process.env.TMDB_API_IP?.trim()

  // 默认路径：与上游一致
  if (!ip) {
    return await $fetch(path, {
      baseURL: options.baseURL,
      params,
      headers: options.headers,
    })
  }

  // 直连指定 IP
  const base = new URL(options.baseURL)
  const search = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  ).toString()
  const basePath = base.pathname.replace(/\/$/, '')

  return await new Promise((resolve, reject) => {
    const req = https.request({
      host: ip,
      port: Number(base.port || 443),
      path: `${basePath}/${path}?${search}`,
      method: 'GET',
      headers: {
        ...(options.headers || {}),
        host: base.host,
      },
      // 关键：SNI 与证书校验仍用域名
      servername: base.hostname,
      timeout: 20000,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        const status = res.statusCode || 502
        if (status >= 400) {
          const error: any = new Error(`TMDB responded ${status}`)
          error.response = { status, _data: text }
          reject(error)
          return
        }
        try {
          resolve(JSON.parse(text))
        }
        catch {
          resolve(text)
        }
      })
    })
    req.on('timeout', () => req.destroy(new Error('tmdb-fetch: timeout')))
    req.on('error', reject)
    req.end()
  })
}
