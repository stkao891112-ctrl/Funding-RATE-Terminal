import requests
import json
import time
from decimal import Decimal, getcontext

# 設定精度
getcontext().prec = 10

def get_bitget_funding_rates(assets, retries=3, retry_delay=1):
    # 基礎 URL
    base_url = "https://api.bitget.com/api/v2/mix/market/current-fund-rate"
    
    # 定義三種產品類型
    product_types = {
        "USDT": "USDT-FUTURES",
        "USDC": "USDC-FUTURES",
        "USD":  "COIN-FUTURES"  # 幣本位
    }

    if isinstance(assets, str):
        assets = [assets.upper()]
    else:
        assets = [a.upper() for a in assets]

    # 用於儲存抓到的所有原始數據
    # 格式: { "USDT": { "BTCUSDT": {...} }, "USDC": {...} }
    raw_market_data = {}

    for attempt in range(1, retries + 1):
        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            all_success = True
            
            for key, p_type in product_types.items():
                res = requests.get(f"{base_url}?productType={p_type}", headers=headers, timeout=10)
                if res.status_code == 200:
                    data = res.json()
                    if data.get('code') == '00000':
                        # 轉成以 symbol 為 key 的字典
                        raw_market_data[key] = {item['symbol']: item for item in data.get('data', [])}
                    else:
                        all_success = False
                else:
                    all_success = False
            
            if all_success:
                break # 全部成功就跳出重試迴圈
        except Exception as e:
            print(f"[Bitget] 第 {attempt} 次錯誤: {e}")
        
        if attempt < retries:
            time.sleep(retry_delay)

    # 處理最終結果
    final_results = []
    for coin in assets:
        def get_std_rate(market_key, symbol_suffix):
            # 根據市場類型組合出 Symbol 名稱
            # USDT -> BTCUSDT, USDC -> BTCUSDC, USD -> BTCUSD
            symbol = f"{coin}{symbol_suffix}"
            market = raw_market_data.get(market_key, {})
            
            if symbol in market:
                item = market[symbol]
                raw_rate = Decimal(item['fundingRate'])
                # Bitget 接口直接提供週期，若無則預設 8
                interval_hrs = Decimal(item.get('fundingRateInterval', 8))
                
                multiplier = Decimal(8) / interval_hrs
                standardized_rate = (raw_rate * multiplier * Decimal(100))
                return float(standardized_rate.quantize(Decimal('0.00001')))
            return None # 找不到資料回傳 null

        final_results.append({
            "exchange": "Bitget",
            "symbol": coin,
            "USDT_rate": get_std_rate("USDT", "USDT"),
            "USDC_rate": get_std_rate("USDC", "PERP"),
            "USD_rate":  get_std_rate("USD", "USD") # 幣本位
        })

    return final_results

if __name__ == "__main__":
    # 測試執行
    test_assets = ["BTC", "ETH", "SOL", "HYPE", "LIT"]
    result = get_bitget_funding_rates(test_assets)
    print(json.dumps(result, indent=4, ensure_ascii=False))