> ℹ️ **说明**：自提交 `4ba044c` 起，代理逻辑已并入前端应用（`server/routes/tmdb`、`server/routes/ipx`），
> 线上**只需要一个部署**即可 —— 推荐看 [deploy-netlify.md](./deploy-netlify.md)。
> 本文档保留的是"独立 proxy + 前端"的**双服务**部署方式，需要时仍可用。

# 部署到 Vercel（双服务）

本项目线上需要**两个 Vercel 项目**：一个跑 TMDB 代理（`proxy/`），一个跑前端（仓库根目录）。

```
浏览器 → 前端项目（Nuxt，仓库根） → 代理项目（Nitro，proxy/） → TMDB API
```

> ⚠️ 本文档是操作指引，**未经过实际部署验证**（需要 Vercel 账号）。步骤依据仓库内的现有配置（`proxy/vercel.json`、`proxy/nitro.config.ts`）、上游作者的同款部署方式，以及 Vercel/Nitro 官方文档整理。若界面文案与本文有差异，按「位置」找对应项即可。

## 0. 前置条件

- 代码已推送到 GitHub 仓库（见 README）
- Vercel 账号（可直接用 GitHub 登录）
- TMDB API Key（本地开发用的那个）

---

## 1. 先部署代理（proxy）

在 Vercel 里 **Add New → Project**，选择你的仓库，然后：

| 配置项 | 值 | 说明 |
|---|---|---|
| **Root Directory** | `proxy` | 关键：告诉 Vercel 只构建子目录 |
| **Include source files outside of the Root Directory** | ✅ 勾选 | 关键：`proxy` 是 pnpm workspace 成员，安装依赖需要读仓库根的 `pnpm-workspace.yaml` 和 `pnpm-lock.yaml`。不勾选会导致安装失败 |
| Framework Preset | 保持自动识别（Nitro） | Nitro 在 Vercel 是零配置，不用手填 Build Command / Output Directory |
| **Environment Variables** | `TMDB_API_KEY = 你的 Key` | 环境勾选 **Production / Preview / Development 全选** |

关于 `TMDB_API_KEY` 的一个重要细节：`proxy/nitro.config.ts` 里是

```ts
runtimeConfig: { tmdb: { apiKey: process.env.TMDB_API_KEY || '' } }
```

这行在**构建时**求值并写进产物。所以变量必须在**构建阶段**就可见——Vercel 的环境变量默认同时提供给构建和运行时，因此按上表设置即可；但如果你只把它设为「Runtime」，构建出来的产物里 Key 会是空字符串，运行时报 `TMDB API key is not set`。

**Node 版本**：仓库根的 `package.json` 用 `devEngines` 要求 Node `^24`。Vercel 新项目的默认 Node 已是 24.x，一般无需处理；若构建报 `devEngines` / Node 版本相关错误，到 **Project Settings → Build and Deployment → Node.js Version** 显式选 `24.x`。

**pnpm 版本**：`proxy/vercel.json` 已内置

```json
{ "installCommand": "npx --yes pnpm@11.1.2 install --frozen-lockfile" }
```

与仓库根 `package.json` 里 `devEngines.packageManager` 要求的 pnpm 11.1.2 一致，所以代理项目不用额外设置。

**部署完成后**，在项目设置里拿到生产域名，形如：

```
https://<你的代理项目名>.vercel.app
```

**验证代理**（把域名替换成你的）：

```bash
curl -s https://<代理域名>/tmdb/configuration | head -c 200
```

返回 `{"change_keys":[...]}` 即成功；若返回 `TMDB API key is not set`，说明第 2 步的环境变量没在构建阶段生效，改完后需要 **Redeploy**（重新部署）让产物重新生成。

---

## 2. 改前端的代理地址（部署前端之前必做）

前端代码里，代理地址是**两处构建时固化的常量**，必须改成代理域名：

| 文件 | 行 | 改成 |
|---|---|---|
| `nuxt.config.ts` | 1 | `const apiBaseUrl = 'https://<代理域名>'` |
| `app/composables/tmdb.ts` | 5 | `const apiBaseUrl = 'https://<代理域名>'` |

顺手把社交分享图也换掉（`app/app.vue:16` 的 `TODO` 处）：

```ts
{ property: 'og:image', content: 'https://<你的前端域名>/social-card.png' },
```

### 2.1 更推荐：用环境变量注入（无需改代码）

代码已支持环境变量覆盖：

```bash
VITE_API_BASE_URL=https://<代理域名> pnpm build
```

- **Vercel 上**：在前端项目的 Environment Variables 里加 `VITE_API_BASE_URL = https://<代理域名>`（Production/Preview/Development 都勾），重新部署即可，仓库代码不用动。
- **不设置该变量时**（默认）：服务端 SSR 直连 `http://localhost:3001`，浏览器端走**同源相对路径**（`/tmdb`、`/ipx`）——适合"本机 + 反向代理 / 内网穿透"的部署方式（同源，无跨域问题，公网域名变了也不用重新构建）。

对应代码（`app/composables/tmdb.ts`）：

```ts
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.server ? 'http://localhost:3001' : '')
```

`nuxt.config.ts` 里的图片 provider baseURL 同样由该变量驱动。

**2.2 老办法：直接改常量**（同样可用，适合只想一次性写死域名的情况）

> **为什么必须改代码，而不能用环境变量？**
> 这两处常量分别被 `fetchTMDB()` 的 `baseURL`（`${apiBaseUrl}/tmdb`）和 Nuxt Image 的 `proxy` provider（`${apiBaseUrl}/ipx`）使用，两者都在构建时写入产物。
> `nuxt.config.ts` 里虽然有一个 `runtimeConfig.public.apiBaseUrl`，但**前端代码里没有任何地方消费它**（没有 `useRuntimeConfig()` 调用），所以设置 `NUXT_PUBLIC_API_BASE_URL` 不会生效。
>
> （本机开发时把这两处改回 `http://localhost:3001` 即可；也可以保持线上域名 + 本地起代理的同时用 hosts/本地 DNS 方案，但最简单的是改回来。）

改完提交并推送：

```bash
git add -A
git commit -m "chore: 前端 apiBaseUrl 指向线上代理"
git push
```

---

## 3. 部署前端（仓库根目录）

再 **Add New → Project**，同一个仓库：

| 配置项 | 值 |
|---|---|
| **Root Directory** | **留空**（= 仓库根目录） |
| Framework Preset | 自动识别为 Nuxt |
| Build Command / Output Directory | 保持默认（不覆盖） |
| Environment Variables | 不需要（`BASE_URL` 模板变量在代码里没有被使用） |

部署完成后访问 `https://<前端域名>`，首页应出现电影数据。

---

## 4. 验证清单

```bash
# 1) 代理直连可返回 TMDB 数据
curl -s https://<代理域名>/tmdb/configuration | head -c 120

# 2) 代理的图片优化端点可用（返回图片二进制/200）
curl -s -o /dev/null -w '%{http_code}\n' "https://<代理域名>/ipx/f_webp,w_500/https://image.tmdb.org/t/p/w500/<任一 poster_path>.jpg"

# 3) 前端页面可访问且有数据
curl -s -o /dev/null -w '%{http_code}\n' https://<前端域名>/
```

浏览器再确认：首页有海报、搜索可用、`/preferences` 多选类型后能出推荐结果、浏览器标签标题是 `wwwmovie`。

---

## 5. 已知注意点

1. **代理有 1 小时缓存**：`proxy/nitro.config.ts` 里 `/tmdb/**` 走 `defineCachedEventHandler`（`maxAge: 3600, swr: true`）。改完数据源/Key 后如果结果没变，属正常缓存行为，等缓存过期或重新部署。
2. **不要用仓库根的 `vercel.json` 配置构建参数**：同一个仓库挂了两个 Vercel 项目时，根 `vercel.json` 里的 `buildCommand` / `installCommand` / `outputDirectory` 会覆盖**所有**项目的设置，造成两个项目互相污染。本项目根目录的 `vercel.json` 只有一个 `{"github":{"silent":true}}`（关掉 GitHub 静默评论），不影响构建，可以保留。
3. **国内访问 `*.vercel.app` 可能不稳定**（本项目本地开发时就遇到过 `api.themoviedb.org` 被 DNS 污染的问题，见 [troubleshooting.md](./troubleshooting.md)）。如果主要面向国内访问者，可考虑其它托管方案；Vercel 侧不需要任何针对国内网络的特殊配置。
4. **代理域名泄漏风险**：代理只转发 TMDB 请求、Key 保存在服务端环境变量里，前端产物中不含 Key；代理的错误响应也会把 Key 替换成 `***`（见 `proxy/routes/tmdb/[...path].ts`）。但仍不要把代理域名当作可随意公开的开放接口扩散。
5. **回退**：想恢复纯本地开发，把第 2 步的两处 `apiBaseUrl` 改回 `http://localhost:3001` 即可，Vercel 上的两个项目可以保留不管。
