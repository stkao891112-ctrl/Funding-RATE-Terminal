from flask import Flask, jsonify, request
from flask_cors import CORS
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

# 保持您原有的導入
from funding.Binance_funding import get_binance_funding_rates
from funding.OKX_funding import get_okx_funding_rates
from funding.Bybit_funding import get_bybit_funding_rates
from funding.Bitget_funding import get_bitget_funding_rates
from funding.Backpack_funding import get_backpack_funding_rates
from funding.Hyperliquid_funding import get_hyperliquid_funding_rates

app = Flask(__name__)
app.json.sort_keys = False

# 因為現在有 Node.js Proxy 代理，CORS 其實可以關閉提升安全性，
# 但為了方便您本地直接調試，建議保留。
CORS(app)

# ─── Cache 設定 ────────────────────────────────────────────────
_cache = {}
CACHE_TTL = 30 

EXCHANGE_FETCHERS = {
    'Binance':     get_binance_funding_rates,
    'OKX':         get_okx_funding_rates,
    'Bybit':       get_bybit_funding_rates,
    'Bitget':      get_bitget_funding_rates,
    'Backpack':    get_backpack_funding_rates,
    'Hyperliquid': get_hyperliquid_funding_rates,
}

def fetch_one(name, func, assets):
    try:
        # 確保 func 能處理 assets 列表
        data = func(assets)
        return name, data
    except Exception as e:
        print(f'[{name}] Error: {e}')
        # 統一回傳格式，確保前端表格不會因為單一交易所故障而碎掉
        return name, [{"USDT_rate": None, "USDC_rate": None, "USD_rate": None} for _ in assets]

# ─── 主要 API ──────────────────────────────────────────────────
# 注意：前端現在請求的是 /api/funding，Proxy 會轉發到這裡
@app.route('/api/funding')
def funding():
    assets_raw = request.args.get('assets', 'BTC,ETH,SOL,HYPE')
    assets = [a.strip().upper() for a in assets_raw.split(',') if a.strip()]

    if not assets:
        return jsonify({'status': 'error', 'message': 'No assets provided'}), 400

    cache_key = ','.join(sorted(assets))
    now = time.time()

    if cache_key in _cache:
        cache_age = now - _cache[cache_key]['ts']
        if cache_age < CACHE_TTL:
            return jsonify({
                'status': 'success',
                'cached': True,
                'age': int(cache_age),
                'data': _cache[cache_key]['data']
            })

    results = {}
    # 使用 ThreadPoolExecutor 並限制最大執行緒，避免小型 Server (如 Render Free Plan) 記憶體溢出
    # max_workers=2 足以處理您的抓取頻率
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(fetch_one, name, func, assets): name
            for name, func in EXCHANGE_FETCHERS.items()
        }
        for future in as_completed(futures):
            name, data = future.result()
            results[name] = data

    # 5. 格式化輸出以配合 React 前端 interface RateData
    combined = {}
    for i, coin in enumerate(assets):
        combined[coin] = {
            'Exchanges': {}
        }
        
        for ex_name in EXCHANGE_FETCHERS.keys():
            ex_data_list = results.get(ex_name, [])
            
            # 確保提取數據時的安全，若長度不匹配則給予 None
            item = ex_data_list[i] if i < len(ex_data_list) else {}
            
            # 這裡的 Key (USDT, USDC, USD) 必須與前端 App.tsx 的解構一致
            combined[coin]['Exchanges'][ex_name] = {
                "USDT": item.get("USDT_rate"),
                "USDC": item.get("USDC_rate"),
                "USD":  item.get("USD_rate")
            }

    _cache[cache_key] = {'ts': now, 'data': combined}

    return jsonify({
        'status': 'success',
        'cached': False,
        'age': 0,
        'data': combined
    })

@app.route('/health')
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    # 改為 debug=False 避免在生產環境不必要的資源消耗
    # 確保 port 與 server.ts 中的代理目標 (8080) 一致
    print("🚀 Python Funding API is starting on http://0.0.0.0:8080")
    app.run(host='0.0.0.0', port=8080, debug=False)
