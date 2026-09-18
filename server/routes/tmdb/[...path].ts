// server/routes/tmdb/[...path].ts
//
// 把 /tmdb/** 转发到 TMDB API。
// 作用与原独立 proxy 服务相同，但并入前端应用 —— 这样线上只需要一个部署，
// 浏览器与服务端都走同源（不存在跨域），本地开发也不必再单独启动 proxy。
//
// API Key 从服务器环境变量读取（Netlify/Vercel 的 Environment variables），
// 本地开发放在项目根目录的 .env 里。
//
// 可选：若本机 DNS 把 api.themoviedb.org 解析到被污染 IP，可设 TMDB_API_IP=<真实IP>
// 让服务端直连该 IP（SNI/证书仍用域名，等价 curl --resolve）。

import https from 'node:https'
import process from 'node:process'

const TMDB_API_URL = 'https://api.themoviedb.org/3'
const TMDB_HOST = 'api.themoviedb.org'

interface TmdbParams {
  [key: string]: unknown
}

function fetchViaIp(ip: string, path: string, params: TmdbParams): Promise<unknown> {
  const search = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  ).toString()

  return new Promise((resolve, reject) => {
    const req = https.request({
      host: ip,
      port: 443,
      path: `/3/${path}?${search}`,
      method: 'GET',
      headers: { accept: 'application/json', host: TMDB_HOST },
      servername: TMDB_HOST,
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

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  const apiKey = process.env.TMDB_API_KEY || ''
  if (!apiKey)
    throw new Error('TMDB API key is not set')

  const path = event.context.params!.path
  const params: TmdbParams = { api_key: apiKey, language: 'en-US', ...query }
  const ip = process.env.TMDB_API_IP?.trim()

  try {
    if (ip)
      return await fetchViaIp(ip, path, params)

    return await $fetch(path, {
      baseURL: TMDB_API_URL,
      params,
      headers: { Accept: 'application/json' },
    })
  }
  catch (e: any) {
    const status = e?.response?.status || 500
    setResponseStatus(event, status)
    return {
      error: String(e)?.replace(apiKey, '***'),
    }
  }
}, {
  maxAge: 3600,
  swr: true,
})
