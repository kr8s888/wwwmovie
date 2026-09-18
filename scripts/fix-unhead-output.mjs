// 修复 Nuxt 4.5.2 + Nitro 2.13.4 生产构建的依赖复制遗漏：
// Nitro 打包 node-server 时，.output/server/node_modules/unhead/dist
// 只复制了部分文件（缺 server.mjs / index.mjs 等），导致运行时
// ERR_MODULE_NOT_FOUND。此脚本在 build 后将 unhead 完整 dist 复制过去。
// 参考：renderer.mjs import 'unhead/server' -> 被重写为 dist/server.mjs

import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const src = resolve('node_modules/unhead/dist')

// 不同部署目标的产物路径不同（node-server 本地启动 / Netlify）
const targets = [
  '.output/server/node_modules/unhead/dist',
  '.netlify/functions-internal/server/node_modules/unhead/dist',
]

let copied = 0
for (const target of targets) {
  const dst = resolve(target)
  if (existsSync(dst)) {
    cpSync(src, dst, { recursive: true, force: true })
    copied += 1
    console.log(`[fix-unhead-output] unhead/dist 已复制到 ${target}`)
  }
}

if (!copied)
  console.warn('[fix-unhead-output] 跳过：未找到需要补齐的产物目录')
