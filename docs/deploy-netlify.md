# 部署到 Netlify（单站点）

应用自身就包含 TMDB 代理与图片优化（`server/routes/tmdb`、`server/routes/ipx`），
所以线上**只需要一个站点**：页面、数据接口、图片优化都由它提供。

线上示例：<https://wwwmovie-kr8s888.netlify.app>

## 1. 导入仓库

Netlify → **Add new project** → **Import a Git repository** → 选你的仓库

| 配置 | 值 |
|---|---|
| Base directory | **留空**（仓库根） |
| Build command / Publish directory | 留空（Netlify 自动识别 Nuxt） |
| Project name | 随意，它决定默认域名 `<name>.netlify.app` |

## 2. 环境变量（唯一必须的配置）

| Key | Value | Scopes |
|---|---|---|
| `TMDB_API_KEY` | 你的 TMDB API Key | 全部（Production / Preview / Deploy previews） |

代码读的是**运行时**的 `process.env`，所以改完环境变量**重新部署一次**即可生效。

## 3. 部署与验证

Deploys → **Trigger deploy** → `Deploy project without cache`

```bash
# 数据接口（应返回 {"change_keys":[...]}）
curl -s https://<你的站点>.netlify.app/tmdb/configuration | head -c 120

# 首页（应 200）
curl -s -o /dev/null -w '%{http_code}
' https://<你的站点>.netlify.app/

# 图片优化（应 200 且 content-type 为 image/webp）
curl -s -o /dev/null -w '%{http_code} %{content_type}
'   "https://<你的站点>.netlify.app/ipx/f_webp,w_500/tmdb/<任一 poster_path>.jpg"
```

## 4. 注意点

1. **站点必须是 public**：若项目标识为 `Private`，需点 **Make public**，否则访问会得到 401（Netlify 的 Login Redirect）。
2. **境外站点在你自己网络下可能打不开**（本机实测 `*.vercel.app` 超时同源问题）。别人可以正常访问；你自己可用手机流量验证。这不是项目问题。
3. **图片优化依赖 `ipx`/`sharp`**：当前在 Netlify Functions 上已验证可用。若某天失效，可把 `nuxt.config.ts` 里的 `image.provider` 改为 `none`，退化为直接使用 TMDB 原图（功能不受影响）。
4. **旧的 `proxy/` 目录仍保留在仓库里**：如果你更想用"独立代理 + 前端"的双服务架构，见 [deploy-vercel.md](./deploy-vercel.md)；也可以把独立代理部署到别处，再用 `VITE_API_BASE_URL` 指向它。
5. **本地与线上跑的是同一套 server routes**，所以不会出现"本地正常、线上异常"的差异——本地验证过的逻辑，线上表现一致。

## 5. 排查记录

部署过程中真实踩到并被记录下来的坑（含定位过程）见 [troubleshooting.md](./troubleshooting.md)。
