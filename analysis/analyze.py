"""数据清洗、统计与可视化 —— 输入 data/movies_raw.csv，输出 output/*.png。

用法：python analysis/analyze.py
"""

import matplotlib
matplotlib.use('Agg')

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE / 'output'
OUT_DIR.mkdir(exist_ok=True)

plt.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False
plt.rcParams['figure.dpi'] = 130

M = 500          # 加权评分的最低票数门槛（与 server/api/recommend.get.ts 保持一致）
MIN_VOTES = 50   # 分析时过滤掉样本量过小的条目
GOLD = '#e0a437' # 与站点主题色一致


def weighted_rating(vote_count, vote_average, m, c):
    """IMDb 加权评分：WR = v/(v+m)·R + m/(v+m)·C"""
    v = vote_count
    return (v / (v + m)) * vote_average + (m / (v + m)) * c


def main():
    df = pd.read_csv(HERE / 'data' / 'movies_raw.csv')
    raw_n = len(df)

    df = df.dropna(subset=['vote_average', 'vote_count'])
    df['year'] = pd.to_numeric(df['release_date'].astype(str).str[:4], errors='coerce')
    df = df[(df['year'] >= 1950) & (df['year'] <= 2030)]
    df = df[df['vote_count'] >= MIN_VOTES].copy()

    c = df['vote_average'].mean()
    df['wr'] = weighted_rating(df['vote_count'], df['vote_average'], M, c)
    corr = df['vote_count'].corr(df['vote_average'])

    print(f'原始 {raw_n} 部 -> 清洗后 {len(df)} 部（票数 >= {MIN_VOTES}，年份 1950-2030）')
    print(f'基准平均分 C = {c:.3f} ｜ 评分中位数 = {df.vote_average.median():.2f}')
    print(f'票数 vs 评分 的相关系数 r = {corr:.3f}（接近 0 即"票多≠分高"）')

    ex = df.assign(genre=df['genres'].fillna('').str.split('|')).explode('genre')
    ex = ex[ex['genre'] != '']
    gstat = ex.groupby('genre').agg(count=('id', 'count'), avg=('vote_average', 'mean')).sort_values('count', ascending=False)

    # 图 1：各类型作品数量与平均分
    fig, ax1 = plt.subplots(figsize=(11, 5))
    ax1.bar(gstat.index, gstat['count'], color=GOLD, alpha=.85)
    ax1.set_ylabel('作品数量')
    ax1.set_title('各类型作品数量与平均评分')
    plt.setp(ax1.get_xticklabels(), rotation=45, ha='right')
    ax2 = ax1.twinx()
    ax2.plot(gstat.index, gstat['avg'], color='#333', marker='o', lw=1.4)
    ax2.set_ylabel('平均评分')
    fig.tight_layout()
    fig.savefig(OUT_DIR / '01_genre_count_avg.png')
    plt.close(fig)

    # 图 2：评分分布
    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.hist(df['vote_average'], bins=40, color=GOLD, edgecolor='white')
    ax.axvline(df['vote_average'].mean(), color='#c0392b', ls='--', label=f"均值 {df.vote_average.mean():.2f}")
    ax.axvline(df['vote_average'].median(), color='#2c3e50', ls=':', label=f"中位数 {df.vote_average.median():.2f}")
    ax.set_xlabel('评分')
    ax.set_ylabel('影片数量')
    ax.set_title('评分分布')
    ax.legend()
    fig.tight_layout()
    fig.savefig(OUT_DIR / '02_rating_distribution.png')
    plt.close(fig)

    # 图 3：评分 vs 票数
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.scatter(df['vote_count'], df['vote_average'], s=9, alpha=.35, color=GOLD)
    ax.set_xscale('log')
    ax.set_xlabel('票数（对数轴）')
    ax.set_ylabel('评分')
    ax.set_title(f'评分与票数的关系（r={corr:.2f}）：票多并不代表分高')
    fig.tight_layout()
    fig.savefig(OUT_DIR / '03_votes_vs_rating.png')
    plt.close(fig)

    # 图 4：加权评分 Top20 vs 纯票数 Top20
    by_wr = df.nlargest(20, 'wr')
    by_votes = df.nlargest(20, 'vote_count')
    overlap = len(set(by_wr['id']) & set(by_votes['id']))
    print(f'加权评分 Top20 与纯票数 Top20 的重叠：{overlap}/20')

    fig, axes = plt.subplots(1, 2, figsize=(13, 6))
    for ax, data, title, col in (
        (axes[0], by_wr, '加权评分 Top20', 'wr'),
        (axes[1], by_votes, '纯票数 Top20', 'vote_count'),
    ):
        ax.barh(range(len(data)), data[col], color=GOLD)
        ax.set_yticks(range(len(data)))
        ax.set_yticklabels([str(t)[:16] for t in data['title']], fontsize=8)
        ax.invert_yaxis()
        ax.set_title(title)
    fig.tight_layout()
    fig.savefig(OUT_DIR / '04_wr_vs_votes_top20.png')
    plt.close(fig)

    # 图 5：年代趋势
    ystat = df[df['year'] >= 1970].groupby('year').agg(count=('id', 'count'), avg=('vote_average', 'mean'))
    fig, ax1 = plt.subplots(figsize=(10, 4.5))
    ax1.bar(ystat.index, ystat['count'], color=GOLD, alpha=.6, label='数量')
    ax1.set_ylabel('数量')
    ax1.set_xlabel('年份')
    ax2 = ax1.twinx()
    ax2.plot(ystat.index, ystat['avg'], color='#c0392b', lw=1.6, label='平均评分')
    ax2.set_ylabel('平均评分')
    ax1.set_title('年代趋势：作品数量与平均评分')
    fig.tight_layout()
    fig.savefig(OUT_DIR / '05_year_trend.png')
    plt.close(fig)

    # 图 6：主要类型的评分箱线图
    top10 = gstat.head(10).index.tolist()
    fig, ax = plt.subplots(figsize=(11, 5))
    data = [ex[ex['genre'] == g]['vote_average'].values for g in top10]
    bp = ax.boxplot(data, tick_labels=top10, patch_artist=True, showfliers=False)
    for box in bp['boxes']:
        box.set(facecolor=GOLD, alpha=.6)
    plt.setp(ax.get_xticklabels(), rotation=45, ha='right')
    ax.set_ylabel('评分')
    ax.set_title('数量前十类型的评分分布')
    fig.tight_layout()
    fig.savefig(OUT_DIR / '06_genre_box.png')
    plt.close(fig)

    # ---- 终端结论 ----
    print('\n平均分最高的 5 个类型：')
    for name, row in gstat.sort_values('avg', ascending=False).head(5).iterrows():
        print(f'  {name}: {row["avg"]:.2f}（{int(row["count"])} 部）')
    print('\n平均分最低的 5 个类型：')
    for name, row in gstat.sort_values('avg').head(5).iterrows():
        print(f'  {name}: {row["avg"]:.2f}（{int(row["count"])} 部）')
    print('\n加权评分 Top10：')
    for _, r in by_wr.head(10).iterrows():
        print(f'  {str(r["title"])[:20]:<22} R={r["vote_average"]:.1f}  v={int(r["vote_count"]):<7} WR={r["wr"]:.3f}')
    print(f'\n图表已输出到 {OUT_DIR}')


if __name__ == '__main__':
    main()
