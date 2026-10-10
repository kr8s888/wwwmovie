# analysis — 数据分析模块

对这个电影站点背后的数据做一层分析，产出图表与结论（见 [../docs/data-analysis.md](../docs/data-analysis.md)）。

## 怎么跑

```bash
# 1) 抓数据（约 1900 部电影，写入 data/movies_raw.csv）
python analysis/fetch_data.py
#    若本机访问 api.themoviedb.org 受限，可先启动应用再走本地转发：
#    TMDB_LOCAL_PROXY=http://localhost:3000 python analysis/fetch_data.py

# 2) 分析并出图（写入 output/*.png，同时在终端打印关键结论）
python analysis/analyze.py
```

依赖：`pandas`、`matplotlib`、`requests`

## 目录

| 路径 | 说明 |
|---|---|
| `fetch_data.py` | 数据采集：TMDB 19 个类型 × 每类前 5 页，去重后落 CSV |
| `analyze.py` | 数据清洗、统计与可视化（6 张图） |
| `data/movies_raw.csv` | 采集结果（已随仓库提供一份，可直接跑 analyze.py） |
| `output/*.png` | 分析图表 |

## 分析内容

1. 各类型的作品数量与平均分
2. 评分分布直方图
3. 评分与票数的关系（散点）——验证"票多 ≠ 分高"
4. 加权评分 Top20 vs 纯票数 Top20 的差异（呼应站点里的榜单算法）
5. 年代趋势：每年作品数量与平均分
6. 主要类型的评分箱线图
