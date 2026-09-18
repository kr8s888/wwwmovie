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

前置条件：

- **Node.js 22+** —— `package.json` 的 `devEngines` 要求 Node `^24`，pnpm ≥ 10.14 会按需自动拉取匹配版本；若下载缓慢，可先手动安装 Node 24
- **pnpm 11** —— 推荐 `npm i -g pnpm@11.1.2`；用 corepack 的话，Windows 上若报权限错误（`EPERM ... Program Files
odejs`）改用 `corepack enable --install-directory "$env:APPDATA
pm"`
- 一个免费的 TMDB API Key

```bash
# 1. 安装依赖（在根目录执行即可：pnpm workspace 会把 proxy 一起装上）
pnpm install

# 2. 配置密钥
cp proxy/.env.example proxy/.env
# Windows PowerShell: Copy-Item proxy\.env.example proxy\.env
# 编辑 proxy/.env，把 TMDB_API_KEY= 后面填上自己的 Key（保存，不要加引号）

# 3. 两个终端分别启动
pnpm dev:proxy   # 终端 1：本地 TMDB 代理，端口 3001
pnpm dev         # 终端 2：开发服务器，端口 3000
```

打开 <http://localhost:3000>；类型推荐入口 <http://localhost:3000/preferences>。

> **不需要改任何代码**：前端默认就指向本地代理 `http://localhost:3001`（定义在 `nuxt.config.ts` 和 `app/composables/tmdb.ts`）。
> 只有当代理与前端不在同一台机器上（即部署到线上）时，才需要用 `VITE_API_BASE_URL` 指定代理地址。

TMDB Key 申请：<https://www.themoviedb.org/signup> 注册后到 <https://www.themoviedb.org/settings/api> 创建（选 Developer，用途随便填）。

```bash
# 生产模式本地验证
pnpm build && pnpm start
```

## 环境变量

| 位置 | 变量 | 说明 |
|---|---|---|
| `proxy/.env` | `TMDB_API_KEY` | TMDB API Key，**只放在这里**；该文件已被 `.gitignore` 忽略，切勿提交 |
| 前端构建时（可选） | `VITE_API_BASE_URL` | 覆盖代理地址。**默认** `http://localhost:3001`；设为具体域名时前后端都用它（线上双服务部署）；设为 `same-origin` 时浏览器走同源相对路径（配合反向代理 / 内网穿透，服务端仍直连本机代理） |

`apiBaseUrl` 的定义在 `nuxt.config.ts` 与 `app/composables/tmdb.ts` 两处。线上部署的完整步骤见 **[docs/deploy-vercel.md](./docs/deploy-vercel.md)**。

> 仓库根目录的 `.env.example` 里的 `BASE_URL` 是上游模板遗留项，当前代码未使用，可忽略。

## 我做了什么

> 边界说明：页面结构、UI 组件、TMDB 请求封装、i18n 框架与代理服务骨架来自上游示例（见文末 Credits）。以下是在此基础上的改动，都标了代码位置，方便核对。

### 1. 新增功能：按类型推荐（多选 → 组合查询 → 排序 → 无限滚动）

- `app/pages/preferences.vue`（75 行）：加载 TMDB 类型列表并网格多选，**上限 3 个**、**至少 2 个**才允许提交，选完跳转 `/recommend?genres=28|35&type=movie`
- `app/pages/recommend.vue`（42 行）：按所选类型请求结果，无限滚动翻页
- `app/composables/tmdb.ts`：`getMediaByGenre` 增加第 4 个参数 `sortBy`（默认 `popularity.desc`，不改变既有调用行为）

技术要点：

- 多类型走 TMDB `discover` 接口的 `with_genres`，多个 id 用 **`|` 连接表示 OR**（`, ` 是 AND）——这是"选了几个类型就都得兼顾"能成立的关键
- 结果按 `sort_by=vote_count.desc` 排序，避免小样本影片靠平均分刷到前面
- 导航栏加入口，中英文文案补齐

### 2. 修复生产构建（开发模式正常、生产模式全站 500）

| 问题 | 根因 | 处理 |
|---|---|---|
| 生产下所有页面 500 | 上游依赖 `nuxt-nightly`，其 `precomputed` 数据在产物里是空桩 | 固定到稳定版 **Nuxt 4.5.2** |
| 运行时 `ERR_MODULE_NOT_FOUND` | `unhead` 声明 `^3.3.1` 被解析到 3.4.x，目录结构不兼容 | 在 `dependencies` 里显式钉死 **3.3.2**（只改 `pnpm.overrides` 会被 pnpm 11 跳过） |
| 产物缺 `unhead/dist` 文件 | Nitro 打包时依赖复制遗漏 | 新增 `scripts/fix-unhead-output.mjs`，挂到 `pnpm build` 之后自动补齐 |

完整的定位过程、命令与验证数据见 **[docs/troubleshooting.md](./docs/troubleshooting.md)**。

### 3. 开发环境与工程化

- 数据源从上游作者部署的代理切到本地代理：`apiBaseUrl` 改为 `http://localhost:3001`（`nuxt.config.ts`、`app/composables/tmdb.ts`）
- 品牌化：站点标题 / `titleTemplate` / description / `og:image` 改为 wwwmovie，页脚、`proxy/routes/index.ts`、`server/api/index.ts` 文案同步；移除指向上游的 `@nuxt_js` twitter 元信息
- i18n 精简：`locales` 从 14 个减到 **en + zh-CN**，删除其余 12 个语言包，并同步修改了 e2e 里写死 `fr-FR` 的语言切换断言
- 目录结构调整（去掉解压产生的嵌套层）、`.gitignore` 补齐、README 重写

### 4. 一次完整的网络层排障（DNS 污染）

本机无法访问 `api.themoviedb.org`，最终定位为 DNS 污染（域名被解析到 Meta 的 IP 段），用 DoH + Node 预加载模块覆盖解析解决，未改任何系统设置。同机对比：**修复前 10.7s 失败 → 修复后 688ms 成功**。过程见 [docs/troubleshooting.md](./docs/troubleshooting.md)。

## Credits & License

- 上游项目：[tastejs/nuxt-movies](https://github.com/tastejs/nuxt-movies)（官方示例），更早的原型 [jasonujmaalvis/vue-movies](https://github.com/jasonujmaalvis/vue-movies)
- License：[MIT](./LICENSE)（保留上游 `Copyright (c) 2022-present - Nuxt Team` 声明）
- 数据来源：

<img height="50px" src="./public/tmdb.svg" alt="The Movie Database logo">

Data provided by [The Movie Database](https://www.themoviedb.org).

This project uses the TMDB API but is not endorsed or certified by TMDB.
