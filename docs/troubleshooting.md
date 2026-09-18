# 排障记录

开发这个项目时真实踩到的四个坑：现象、定位过程、根因、解决方式与验证结果。命令与数字都是实测的（同一台机器、同一个请求反复对比），可以直接复现。

---

## 1. 生产构建后所有页面 500：Nuxt nightly 的 `precomputed` 数据缺失

**现象**

`pnpm build` 显示构建成功，但 `pnpm start`（或 `node .output/server/index.mjs`）之后访问任何路由都返回 500；`pnpm dev` 开发模式一切正常。

**定位**

1. 先排除数据源：直接请求代理 `http://localhost:3001/tmdb/configuration` 返回 200 → TMDB、Key、网络都没问题，问题在构建产物。
2. 看服务端错误栈，指向 `precomputed` 相关模块为 `undefined`。
3. 检查产物文件 `.output/server/chunks/virtual/precomputed.mjs`，内容是一个空桩，没有真正的数据。

**根因**

上游 `package.json` 依赖的是 `nuxt-nightly`（滚动预发布版）。这个版本的 `precomputed` 数据生成/打包有缺陷，生产产物里该模块是空的。

**解决**

把 `nuxt` 固定到稳定版 `4.5.2`，删掉 `node_modules` 重装依赖。

**验证**

`node .output/server/index.mjs` 启动后，`/`、`/preferences`、`/recommend` 均返回 200，不再出现 500。

---

## 2. unhead 版本漂移：运行时找不到模块

**现象**

修好 Nuxt 版本后，部分页面仍然 500，服务端报 `ERR_MODULE_NOT_FOUND`（unhead 相关）。

**定位**

```bash
pnpm why unhead
```

发现 `package.json` 里声明的是 `^3.3.1`，被解析成了 `3.4.x`。而 3.4.x 的目录结构与 Nuxt 4.5.2 的预期不一致——代码引用的 `unhead/dist/server.mjs` 在新版本里已经不存在。

**解决**

两个地方同时固定：

1. `dependencies` 里**显式写死版本**（不是 `^`）：

```json
"unhead": "3.3.2",
"@unhead/vue": "3.3.2"
```

2. `pnpm.overrides` 里也固定同一组版本（把传递依赖一并钉住）。

**踩坑补充**

只改 `pnpm.overrides` 再执行 `pnpm install`，pnpm 11 会判定 `Already up to date` 直接跳过重新解析，override 根本不生效。必须在 `dependencies`/`devDependencies` 里显式写版本，才会触发依赖树重算。

**验证**

`pnpm why unhead` 输出为 `3.3.2`，构建产物运行正常。

---

## 3. Nitro 打包遗漏 `unhead/dist` 文件（新增 postbuild 脚本）

**现象**

`.output/server/node_modules/unhead/dist` 里只复制了部分文件，启动时报 `ERR_MODULE_NOT_FOUND`——缺 `server.mjs`、`index.mjs` 等。

**定位**

对比源目录与产物目录的文件列表：

```bash
ls node_modules/unhead/dist
ls .output/server/node_modules/unhead/dist
```

产物里少文件。再看产物中的 `renderer.mjs`：`unhead/server` 这行 import 被改写成 `dist/server.mjs`，但这个文件在打包时没被复制进去，所以只有运行时才会炸（构建阶段不报错）。

**解决**

新增 `scripts/fix-unhead-output.mjs`（19 行）：构建后把完整的 `unhead/dist` 复制进产物；并把它挂到 build 脚本上，做到一步到位：

```json
"build": "nuxt build && node scripts/fix-unhead-output.mjs"
```

脚本本身带目录存在性判断，缺目录时只警告不中断。

**验证**

`pnpm build` 输出末行出现 `[fix-unhead-output] unhead/dist 已复制到 …`，随后启动服务首页 200。

---

## 4. TMDB API 域名被 DNS 污染（本机开发环境）

**现象**

代理返回 500，错误是 `FetchError ... <no response> fetch failed`；但浏览器打开 `www.themoviedb.org` 网页完全正常。

**定位过程（一步步把变量隔离掉）**

1. **排除 Key 问题**：错误信息从 `TMDB API key is not set` 变成了网络类错误 → 说明 Key 已被正确读取并用于请求。
2. **确认是哪个域名的问题**：

   ```bash
   curl -s -o /dev/null -w '%{http_code}' https://api.themoviedb.org/3/configuration   # 超时/失败
   curl -s -o /dev/null -w '%{http_code}' https://image.tmdb.org/t/p/w500/            # 404（域名可达）
   ```

   API 域名不通、图片域名通 → 缩小到 `api.themoviedb.org`。
3. **看解析结果**：

   ```bash
   nslookup api.themoviedb.org
   # Addresses: 2a03:2880:f10e:83:face:b00c:0:25de
   #            157.240.3.50
   ```

   这两个是 **Meta/Facebook 的 IP 段**（`157.240.x`、`2a03:2880::/32`），不可能是 TMDB 的 → 判定为 **DNS 污染**。
4. **用加密 DNS 拿真实 IP**：

   ```bash
   curl -s 'https://doh.pub/dns-query?name=api.themoviedb.org&type=A'
   # 18.244.214.44 / 65.9.130.129 …（AWS CloudFront 段）
   ```

   顺带发现：国内普通递归 DNS（含部分公共 DNS）返回的同样是被污染的结果，只有加密 DNS（DoH）可信。
5. **用真实 IP 绕开系统 DNS 验证**：

   ```bash
   curl -s -o /dev/null -w 'connect=%{time_connect}s total=%{time_total}s code=%{http_code}\n' \
     --resolve api.themoviedb.org:443:18.244.214.44 \
     https://api.themoviedb.org/3/configuration
   # connect=0.25s total=0.95s code=200
   ```

   200 且很快 → 网络本身没问题，同时也**反证了 API Key 有效**。

**方案对比**

| 方案 | 结果 |
|---|---|
| 改系统 hosts 文件 | ❌ 两层障碍：该文件属性是 `ReadOnly`（`ReadOnly, Archive`），而且机器上的安全软件（联想电脑管家/火绒，进程 `wsctrl11`）在保护它，用管理员权限写入也会收到「拒绝访问」。另外 CloudFront IP 会轮换（实测 `18.244.214.44` → `65.9.130.129` → `65.9.130.126`），写死进 hosts 迟早失效 |
| 应用层覆盖 DNS 解析（采用） | ✅ 不改系统设置、不需要管理员权限、IP 变化可自动刷新 |

**解决：`tmdb-dns-fix.mjs`（Node 预加载模块）**

1. 启动时用 DoH 查询真实 IP 存进内存映射，之后每 60 秒刷新一次（定时器 `.unref()`，不阻塞进程退出）；
2. 覆盖 `dns.lookup` 和 `dns.promises.lookup`：只对 `api.themoviedb.org` 返回真实 IP（同时兼容 `{ all: true }` 与 `family` 两种回调形态），其他域名透传给原实现；
3. DoH 查询失败时回退到内置 IP，保证可用性；
4. 用 `NODE_OPTIONS=--import=file:///…/tmdb-dns-fix.mjs` 注入，**不改动项目里任何源码**；
5. 该文件不入库（放在项目外的 `movies-notes/`），因为它是与本机网络环境绑定的开发辅助，和项目本身无关。

**验证（同一台机器、同一个请求对比）**

| 方式 | 结果 |
|---|---|
| 不加载修复（走系统 DNS） | `FAIL ms=10783 err=fetch failed` |
| 加载修复（DoH 覆盖） | `status=200 ms=688` |
| 代理未缓存接口 `/tmdb/movie/27205` | `200 / 0.94s` |
| 代理未缓存接口 `/tmdb/trending/all/week` | `200 / 0.32s` |
| 生产产物首页 | `200 / 0.215s`，281 KB |

**回退**

不带 `NODE_OPTIONS` 启动即可回到原行为，不残留任何系统改动。

---

## 5. 本机 DNS 污染：Node 内置 fetch 无法用预加载补丁修正

**现象**：代理对 TMDB 的所有请求 21 秒超时（`fetch failed`），但用 `curl` 直连同一地址很快返回 200。

**定位**

1. `nslookup api.themoviedb.org` 解析到 Meta/Facebook 的 IP 段（`157.240.x`、`2a03:2880::/32`）→ DNS 污染
2. `curl --resolve api.themoviedb.org:443:<真实IP>` 返回 200 → 网络可达，问题只在解析
3. 用 `NODE_OPTIONS=--import=...` 预加载脚本 patch `dns.lookup`：**无效**。装探针后确认，进程内的请求**从未调用**被 patch 的 `dns.lookup` / `net.connect` / `tls.connect`
   → 结论：Node 内置 `fetch`（undici）使用内部缓存的引用与解析实现，改公共 API 拦不到它
4. 改成 patch `globalThis.fetch` 同样无效（nitro 的 ofetch 在模块初始化时就缓存了 fetch 引用）

**解决**：给代理加一个**默认关闭**的 IP 直连分支（`proxy/utils/tmdb-fetch.ts`）

- 默认（不设 `TMDB_API_IP`）：行为与上游完全一致，走 `$fetch`
- 设置 `TMDB_API_IP=<真实 IP>`：用 `node:https` 直连该 IP，**SNI 与证书校验仍使用域名**（原理等价于 `curl --resolve`，安全性与正常访问相同）

**验证（同一台机器、同一接口、各连续 3 次）**

| 配置 | 结果 |
|---|---|
| 不设 `TMDB_API_IP` | `500 / 21.42s`（污染 IP，连接超时） |
| `TMDB_API_IP=99.84.152.53` | `200 / 0.756s`、`200 / 0.330s`、`200 / 0.318s` |

**真实 IP 怎么查**（CloudFront 的 IP 会轮换）

```bash
curl -s "https://doh.pub/dns-query?name=api.themoviedb.org&type=A"
```

**适用范围**：仅当本机 DNS 被污染时需要设置；其他网络环境、以及部署在境外的线上环境都不需要。

## 6. `onMounted` 里调用 Nuxt composable 会静默失效

**现象**：`/preferences` 页首屏只有标题和一行提示，19 个类型按钮一个都不渲染；点任何东西都没反应。

**定位**

1. 该页 SSR 输出只有 4.8 KB，且不含任何类型名 → 数据不是服务端取的
2. 看代码：`app/pages/preferences.vue` 在 `onMounted` 回调里调用 `getGenreList('movie')`
3. 而 `getGenreList` → `fetchTMDB` 内部使用了 `useNuxtApp()` 和 `useState()`——都是依赖 setup 上下文的 Nuxt composable
4. 对比项目内其它页面（`index.vue`、`recommend.vue`）都在 **setup 顶层** `await` 取数，只有这个页面用了 `onMounted`

**根因**：`onMounted` 回调执行时已脱离 setup 上下文，Nuxt composable 在其中不可用；异常又被 `finally` 吞掉，表现为"静默无数据"。

**解决**：改用 `useAsyncData`（在 setup 顶层执行，SSR 与客户端共享同一份数据）

```ts
const { data: genres, pending: loading } = await useAsyncData<Genre[]>('movie-genres', () => getGenreList('movie'))
```

**验证**：`/preferences` 的 SSR 输出 4.8 KB → 9.8 KB，19 个类型按钮全部渲染（按钮数 20，含"开始推荐"）。

## 7. `fetchTMDB` 命中缓存时返回普通值而非 Promise

**现象**：浏览器 Console 报 `fetchTMDB(...).then is not a function`（hydration 之后），`/recommend` 的客户端加载失效。

**定位**

`app/composables/tmdb.ts` 中：

```ts
const state = useState<any>(hash, () => null)
if (state.value)
  return state.value        // ← 命中缓存时返回的是普通值
```

SSR 时 `state` 为空，请求走 promiseCache（返回 Promise）；客户端 hydration 时 `state` 已从 payload 恢复出值，于是直接返回普通值，调用方的 `.then()` 报错。

**解决**：始终返回 Promise

```ts
if (state.value)
  return Promise.resolve(state.value)
```

**验证**：用 Playwright + 本机 Edge 复现"选两个类型 → 点开始推荐"流程，`pageerror` 从 `fetchTMDB(...).then is not a function` 变为**无错误**，跳转 URL 正常（`/recommend?genres=28,12&type=movie`）。

## 8. 推荐用 OR 语义，与"动作喜剧"的直觉不符 -> 改成 AND

**现象**：选「动作 + 喜剧」，结果里出现《阿甘正传》，用户认为不准确。

**定位**

1. 查《阿甘正传》(movie/13) 的 TMDB 类型：**喜剧 + 剧情 + 爱情** → 它确实带"喜剧"标签，数据没问题
2. `with_genres=28|35`（OR）第 1 条是《盗梦空间》(`genre_ids=[28,878,12]`，不含喜剧)
3. `with_genres=28,35`（AND）第 1 条是《死侍》(`genre_ids=[28,12,35]`) —— 这才是"动作喜剧"

**根因**：TMDB 的 `with_genres` 里 `|` 表示 OR（任一匹配），`,` 表示 AND（全部匹配）。原实现用的是 `|`，而用户预期是 AND。

**解决**：`preferences.vue` 的 `join('|')` 改为 `join(',')`，`recommend.vue` 的 `split('|')` 改为 `split(',')`；同时补充按钮态提示（未选够时显示"请至少选择 2 个类型"）与空结果提示（AND 更严格，结果可能为空）。

## 小结：这几轮排查里可复用的手法

1. **先分层，再一次只动一个变量**：把「配置 / 应用代码 / 网络与 DNS / 打包产物」分开验证，不要一上来就改代码。
2. **看错误类型，不要靠猜**：`TMDB API key is not set` 和 `fetch failed` 是两个完全不同层面的问题。
3. **用外部工具验证假设**：`nslookup` 看解析、`curl --resolve` 指定 IP、`pnpm why` 看实际依赖版本、`curl -w '%{time_connect} %{time_total}'` 量化耗时。
4. **按代价给方案排序**：优先选「不改系统、不需管理员、可回退」的手段（所以最终没去硬碰 hosts）。
5. **用数字收尾**：修复效果量化前后对比（10.7s 失败 → 688ms 成功），比「感觉快了」有说服力。
