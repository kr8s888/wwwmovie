# 部署到 Netlify（双服务）

线上需要**两个 Netlify 站点**：一个跑 TMDB 代理（`proxy/`），一个跑前端（仓库根）。

```
浏览器 → 前端站点（Nuxt） → 代理站点（Nitro） → TMDB API
```

> ⚠️ 本文档按仓库现有配置 + Nitro/Netlify 官方文档整理，**尚未经过真实部署验证**（需要 Netlify 账号）。
> 但其中"Netlify 构建产物"这一步已经在本地实测通过：
>
> ```bash
> NITRO_PRESET=netlify pnpm build
> # proxy  → .netlify/functions-internal/server/{main,server}.mjs
> # 前端   → .netlify/functions-internal/server/...（含补齐的 unhead/dist）
> ```
>
> 另注：Netlify 对 Nitro 是**零配置**——它会在构建环境里自动识别 Nitro 并生成 `_redirects`，不需要手写重定向规则。

## 0. 前置

- 代码已推送到 GitHub
- Netlify 账号（直接用 GitHub 登录）
- TMDB API Key

## 1. 先部署代理（proxy）

Netlify → **Add new site → Import an existing project → GitHub** → 选 `kr8s888/wwwmovie`，然后：

| 配置项 | 值 | 说明 |
|---|---|---|
| **Base directory** | `proxy` | 在导入页的 Build settings 里填（**不要手写 netlify.toml**：显式 build 配置会让 Netlify 放弃对 Nitro 的自动检测，从而不生成路由规则，导致全站 404） |
| Build command / Publish directory | **留空** | Netlify 自动识别 Nitro（不要手填，填了反而会冲突） |
| **Environment variables** | `TMDB_API_KEY = 你的 Key` | 环境勾选 **Production / Preview / Deploy previews 全部** |

关于 `TMDB_API_KEY`：`proxy/nitro.config.ts` 里是

```ts
runtimeConfig: { tmdb: { apiKey: process.env.TMDB_API_KEY || '' } }
```

这行在**构建时**求值写进产物，所以变量必须在**构建阶段**可见（Netlify 的环境变量默认构建+运行时都可用，按上表设置即可）。

依赖安装说明：`proxy` 是仓库根 pnpm workspace 的成员，`pnpm-workspace.yaml` 在仓库根。Netlify 检测到 workspace 后会在**仓库根**执行安装，再在 `base` 目录执行构建——这正是我们要的行为。

部署完成后拿到站点地址，形如 `https://<站点名>.netlify.app`。

**验证代理**（换成你的地址）：

```bash
curl -s https://<代理站点>.netlify.app/tmdb/configuration | head -c 200
```

- 返回 `{"change_keys":[...]}` → ✅
- 返回 `TMDB API key is not set` → 环境变量没在构建阶段生效，设置后 **Redeploy**（改环境变量不会自动重建产物）
- 返回 502/404 → 见下面「已知问题」

## 2. 配前端要用的代理地址（部署前端之前）

前端代码已经支持环境变量覆盖代理地址，**不需要改源码**：

在**前端站点**（第 3 步创建的那个）里设置

```
VITE_API_BASE_URL = https://<代理站点>.netlify.app
```

优先级逻辑（`app/composables/tmdb.ts`、`nuxt.config.ts`）：

- 不设置该变量 → 默认 `http://localhost:3001`（本地开发用）
- 设为具体域名 → 前端与 SSR 都用它（线上就是这种）
- 设为 `same-origin` → 浏览器走同源相对路径（配合反向代理 / 内网穿透时用）

## 3. 部署前端（仓库根）

再 **Add new site → Import an existing project** → 同一个仓库：

| 配置项 | 值 |
|---|---|
| **Base directory** | **留空**（= 仓库根） |
| Build command / Publish directory | 留空（自动识别 Nuxt） |
| Environment variables | `VITE_API_BASE_URL = https://<代理站点>.netlify.app` |

部署完成后打开 `https://<前端站点>.netlify.app`，首页应该出现海报。

## 4. 验证清单

```bash
# 1) 代理能取到 TMDB 数据
curl -s https://<代理站点>.netlify.app/tmdb/configuration | head -c 120

# 2) 代理的图片优化端点
curl -s -o /dev/null -w '%{http_code}\n' "https://<代理站点>.netlify.app/ipx/f_webp,w_500/https://image.tmdb.org/t/p/w500/<任一 poster_path>.jpg"

# 3) 前端页面
curl -s -o /dev/null -w '%{http_code}\n' https://<前端站点>.netlify.app/
```

浏览器再确认：首页有海报、搜索可用、`/preferences` 选 2~3 个类型能出推荐、标题是 `wwwmovie`。

## 4.1 关于路由（`_redirects`）

Netlify 上 Nitro 的请求转发依赖构建产物 `dist/_redirects`。两条保障：

1. Netlify 检测到 Nitro 时会自动生成（所以**不要在仓库里放 netlify.toml**，否则自动检测失效）；
2. 仓库里另有一份显式兜底：`proxy/public/_redirects`

```
/*    /.netlify/functions/server   200
```

Nitro 构建时会把它复制到 `dist/` 并追加自己的规则（本地验证：`NITRO_PRESET=netlify pnpm build` 后 `proxy/dist/_redirects` 应包含上面这行）。

## 5. 注意点与已知问题

1. **境外站点在你自己网络下可能打不开**：本机实测过 `*.vercel.app` 直接超时（DNS 污染 + 线路问题）。Netlify 同理——**别人能访问，你自己可能需要换网络（手机流量）验证**。这不属于项目问题。
2. **代理有 1 小时缓存**：`proxy/nitro.config.ts` 里 `/tmdb/**` 走 `defineCachedEventHandler`（`maxAge: 3600, swr: true`），改数据源后结果不会立刻变。
3. **已知上游 bug（可能命中）**：Nuxt/Nitro issue [#27026](https://github.com/nuxt/nuxt/issues/27026)——Netlify 构建时生成的 `_redirects` 可能指向并不存在的 `/.netlify/builders/server`，导致访问 404。若命中：在站点设置的 **Functions** 里确认函数目录是 `.netlify/functions-internal`，或把生成错误的 `_redirects` 删掉后重新部署；升级 Nuxt/Nitro 小版本也通常能绕开。
4. **.gitignore 已忽略 `.netlify`**（构建产物不入库）。
5. **回退**：前端站点把 `VITE_API_BASE_URL` 删掉重新部署，就回到"默认本地代理"；本地开发不需要这个变量。
6. **不想用 Netlify 也能换**：`docs/deploy-vercel.md` 是 Vercel 版（配置已随仓库提供，只是 Vercel 注册要手机验证）。
