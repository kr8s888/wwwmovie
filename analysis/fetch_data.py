"""抓取 TMDB 电影数据，输出 CSV（供 analyze.py 分析使用）。

用法（在项目根目录执行）：

    # 1) 直连 TMDB API（正常网络环境）
    python analysis/fetch_data.py

    # 2) 走本地运行的应用（本机访问 api.themoviedb.org 受限时）
    #    先启动应用，再执行：
    TMDB_LOCAL_PROXY=http://localhost:3000 python analysis/fetch_data.py

环境变量：
    TMDB_API_KEY      直连模式需要；未设置时会尝试从项目根 .env 读取
    TMDB_LOCAL_PROXY  可选，本地应用地址（走应用内的 /tmdb 转发，自动带 key）

采集范围：TMDB 全部 19 个电影类型 × 每类型按票数取前 5 页（约 100 部）= 约 1900 条记录（去重后）
"""

import csv
import os
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA_DIR = HERE / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)

PAGES_PER_GENRE = 5
SLEEP_BETWEEN_REQUESTS = 0.15


def load_api_key() -> str:
    key = os.environ.get('TMDB_API_KEY', '').strip()
    if key:
        return key
    env_file = ROOT / '.env'
    if env_file.exists():
        for line in env_file.read_text(encoding='utf-8').splitlines():
            if line.startswith('TMDB_API_KEY='):
                return line.split('=', 1)[1].strip()
    raise SystemExit('未找到 TMDB_API_KEY（请设置环境变量，或写入项目根目录的 .env）')


def resolve_base() -> tuple[str, dict]:
    """返回 (接口基地址, 公共查询参数)。走本地代理时由应用负责带 key。"""
    proxy = os.environ.get('TMDB_LOCAL_PROXY', '').strip()
    if proxy:
        return proxy.rstrip('/') + '/tmdb', {'language': 'zh-CN'}
    return 'https://api.themoviedb.org/3', {'api_key': load_api_key(), 'language': 'zh-CN'}


def get(url: str, params: dict, retries: int = 3):
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, timeout=25)
            if resp.status_code == 200:
                return resp.json()
            print(f'  HTTP {resp.status_code}: {resp.text[:120]}')
        except Exception as exc:  # noqa: BLE001
            print(f'  请求失败：{str(exc)[:120]}')
        time.sleep(1.5 * (attempt + 1))
    return None


def main() -> None:
    base, common = resolve_base()
    print(f'数据源：{base}')

    genres_resp = get(f'{base}/genre/movie/list', dict(common))
    if not genres_resp:
        raise SystemExit('无法获取类型列表，请检查网络或 API Key')
    genres = genres_resp['genres']
    genres[0:0] = []
    genre_name = {g['id']: g['name'] for g in genres}
    print(f'类型数量：{len(genres)}')

    rows: dict[int, dict] = {}
    for genre in genres:
        for page in range(1, PAGES_PER_GENRE + 1):
            data = get(f'{base}/discover/movie', {
                **common,
                'with_genres': genre['id'],
                'sort_by': 'vote_count.desc',
                'page': page,
            })
            for item in (data or {}).get('results', []):
                ids = item.get('genre_ids') or []
                rows[item['id']] = {
                    'id': item['id'],
                    'title': item.get('title') or item.get('name') or '',
                    'release_date': item.get('release_date') or '',
                    'vote_average': item.get('vote_average') or 0,
                    'vote_count': item.get('vote_count') or 0,
                    'popularity': item.get('popularity') or 0,
                    'original_language': item.get('original_language') or '',
                    'genre_ids': '|'.join(str(i) for i in ids),
                    'genres': '|'.join(genre_name.get(i, str(i)) for i in ids),
                }
            time.sleep(SLEEP_BETWEEN_REQUESTS)
        print(f"  {genre['name']}：累计 {len(rows)} 部")

    out = DATA_DIR / 'movies_raw.csv'
    with out.open('w', encoding='utf-8-sig', newline='') as fh:
        writer = csv.DictWriter(fh, fieldnames=list(next(iter(rows.values())).keys()))
        writer.writeheader()
        writer.writerows(rows.values())
    print(f'完成：{len(rows)} 部 -> {out}')


if __name__ == '__main__':
    main()
