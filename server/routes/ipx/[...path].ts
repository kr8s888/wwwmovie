// server/routes/ipx/[...path].ts
//
// 图片优化端点（/ipx/**），与原独立 proxy 服务里的实现一致。
// 并入前端应用后，线上单个部署即可同时提供页面、数据和图片优化。

import { fromWebHandler } from 'h3'
import { createIPX, createIPXFetchHandler, ipxHttpStorage } from 'ipx'

const ipx = createIPX({
  maxAge: 3600,
  alias: {
    '/tmdb': 'https://image.tmdb.org/t/p/original/',
    '/youtube': 'https://img.youtube.com/',
  },
  storage: ipxHttpStorage({
    domains: [
      'image.tmdb.org',
      'img.youtube.com',
    ],
  }),
})

const handler = createIPXFetchHandler(ipx)

export default fromWebHandler((request) => {
  const url = new URL(request.url)
  url.pathname = url.pathname.replace(/^\/ipx(?=\/|$)/, '')
  return handler(new Request(url, request))
})
