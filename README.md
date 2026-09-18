<br><p align="center">
<img height="100px" src="./public/movies.webp" alt="Movies logo" />
</p>

<h1 align="center">wwwmovie · 电影浏览与按类型推荐</h1>
<br>

> 基于 [Nuxt](https://github.com/nuxt/nuxt) 的电影浏览网站，在 Nuxt 官方示例 [tastejs/nuxt-movies](https://github.com/tastejs/nuxt-movies)（MIT）基础上二次开发，数据来自 [The Movie Database (TMDB)](https://www.themoviedb.org) API。
>
> 技术栈：[Nuxt](https://github.com/nuxt/nuxt) · [Vue](https://github.com/vuejs/core) · [UnoCSS](https://github.com/unocss/unocss) · [Nuxt Image](https://image.nuxt.com) · [TypeScript](https://github.com/microsoft/TypeScript) · [Nitro](https://nitro.build)（代理层）

## 功能

- **首页 / 发现页**：热门、正在上映、即将上映、高分榜单
- **搜索**：电影与演员搜索
- **详情页**：电影详情（演员、剧照、相似推荐）、演员详情
- **按类型推荐**（本项目新增）：多选类型（最多 3 个）→ 走 TMDB `discover` 接口做多类型 OR 过滤 → 按评分人数排序 → 无限滚动加载

## 架构

```
浏览器 / Nuxt 前端(3000)  →  Nitro 代理(3001, proxy/)  →  TMDB API
```

API Key 只存在于代理服务端的环境变量里，前端代码中不出现任何密钥。

## 本地运行

前置：Node.js 22+、`corepack`（用于启用 pnpm）、一个免费的 TMDB API Key。

```bash
# 1. 启用 pnpm 并安装依赖（根目录与 proxy 各一次）
corepack enable
pnpm install
cd proxy && pnpm install && cd ..

# 2. 配置密钥：复制模板后填入自己的 Key
cp proxy/.env.example proxy/.env
# PowerShell 用：Copy-Item proxy\.env.example proxy\.env
# 编辑 proxy/.env，把 TMDB_API_KEY= 后面填上自己的 Key（保存，勿加引号）

# 3. 两个终端分别启动
pnpm dev:proxy   # 终端 1：本地 TMDB 代理，端口 3001
pnpm dev         # 终端 2：开发服务器，端口 3000
```

打开 <http://localhost:3000> ；类型推荐入口：<http://localhost:3000/preferences>。

TMDB Key 申请：<https://www.themoviedb.org/signup> 注册后到 <https://www.themoviedb.org/settings/api> 创建（选 Developer，用途随便填）。

```bash
# 生产模式本地验证
pnpm build && pnpm start
```

## 环境变量

| 位置 | 变量 | 说明 |
|---|---|---|
| `proxy/.env` | `TMDB_API_KEY` | TMDB API Key，**只放在这里**，已被 `.gitignore` 忽略，切勿提交 |
| `.env`（根目录） | `BASE_URL` | 前端站点地址，默认 `http://localhost:3000` |

`apiBaseUrl`（`nuxt.config.ts` 与 `app/composables/tmdb.ts`）当前指向本地代理 `http://localhost:3001`；部署到线上时改成代理服务的公网地址。

## 与上游的差异

- 新增「按类型推荐」两页（`app/pages/preferences.vue`、`app/pages/recommend.vue`），`getMediaByGenre` 增加 `sortBy` 参数，导航栏加入口
- 依赖从 `nuxt-nightly` 降到稳定版 Nuxt 4.5.2，并显式固定 `unhead` / `@unhead/vue` 3.3.2（修复 nightly 的 `precomputed` 数据缺失导致的 500，以及 unhead 版本漂移）
- 新增 `scripts/fix-unhead-output.mjs`，在 `pnpm build` 后补齐 Nitro 打包遗漏的 unhead 文件
- 数据源由上游代理切换为本地代理，`apiBaseUrl` 改为 `http://localhost:3001`
- 中英文语言包补充推荐功能文案；语言包精简为 en + zh-CN（其余 12 个已删除）
- 站点名称品牌化为 wwwmovie（`app/app.vue` 标题与描述、页脚、proxy/server 文案、e2e 断言），并移除上游的 twitter 账号元信息
- 目录结构整理、README 重写

## Credits & License

- 上游项目：[tastejs/nuxt-movies](https://github.com/tastejs/nuxt-movies)（官方示例），更早的原型 [jasonujmaalvis/vue-movies](https://github.com/jasonujmaalvis/vue-movies)
- License：[MIT](./LICENSE)（保留上游 `Copyright (c) 2022-present - Nuxt Team` 声明）
- 数据来源：

<img height="50px" src="./public/tmdb.svg" alt="The Movie Database logo">

Data provided by [The Movie Database](https://www.themoviedb.org).

This project uses the TMDB API but is not endorsed or certified by TMDB.
