// server/api/recommend.get.ts
//
// 类型推荐接口：按「加权评分」（IMDb 的 weighted rating 公式）排序。
//
// 为什么需要它：TMDB 的 discover 接口只能按单一字段排序
//   * sort_by=vote_average.desc  → 票数很少的冷门高分片会排在前面（不靠谱）
//   * sort_by=vote_count.desc    → 票多的商业大片总能排前面（不够"好片"）
// 经典做法（IMDb Top 250 用的就是它）是加权评分：
//
//     WR = (v / (v + m)) · R + (m / (v + m)) · C
//
//   v = 该影片的票数 vote_count
//   R = 该影片的平均分 vote_average
//   m = 最低票数门槛（默认 500）：票数越少，评分被越多地"压"向基准分
//   C = 基准平均分（这里取候选池的平均分）
//
// 由于 TMDB 不支持服务端按 WR 排序，这里先在服务端拉一个候选池
// （按票数取前几页，保证候选都是票数足够的影片），再本地计算 WR 并整体重排。

function weightedRating(v: number, r: number, m: number, c: number): number {
  return (v / (v + m)) * r + (m / (v + m)) * c
}

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  const type = String(query.type || 'movie')
  const genres = String(query.genres || '')
  const language = String(query.language || 'zh-CN')
  const m = Number(query.m ?? 500)
  const pool = Math.min(Math.max(Number(query.pool ?? 3), 1), 5)

  const apiKey = process.env.TMDB_API_KEY || ''
  if (!apiKey)
    throw new Error('TMDB API key is not set')
  if (!genres)
    throw new Error('genres is required')

  // 候选池：按票数降序取前 pool 页（20/页）
  // 走应用内已有的 /tmdb/** 转发路由（服务端内部调用）：
  // 自动继承 TMDB_API_IP 直连能力与缓存，也不必在这里重复实现鉴权
  const pages = await Promise.all(
    Array.from({ length: pool }, (_, i) => i + 1).map(page =>
      $fetch(`/tmdb/discover/${type}`, {
        params: { with_genres: genres, sort_by: 'vote_count.desc', page, language },
      }).catch((error) => {
        console.error(`[recommend] 拉取候选页失败 page=${page}`, String(error).slice(0, 200))
        return { results: [] as any[] }
      }),
    ),
  )

  // 合并去重
  const byId = new Map<number, any>()
  for (const page of pages as Array<{ results?: any[] }>) {
    for (const item of page.results || []) {
      if (!byId.has(item.id))
        byId.set(item.id, item)
    }
  }
  const candidates = [...byId.values()]

  // 基准平均分 C = 候选池平均分
  const c = candidates.length
    ? candidates.reduce((sum, item) => sum + (item.vote_average || 0), 0) / candidates.length
    : 0

  const results = candidates
    .map(item => ({
      ...item,
      weighted_rating: weightedRating(item.vote_count || 0, item.vote_average || 0, m, c),
    }))
    .sort((a, b) => b.weighted_rating - a.weighted_rating)

  return {
    results,
    meta: {
      formula: 'WR = (v / (v + m)) * R + (m / (v + m)) * C',
      m,
      c: Number(c.toFixed(3)),
      candidates: candidates.length,
      pool,
    },
  }
}, {
  maxAge: 3600,
  swr: true,
})
