import requests
import json
import time
from decimal import Decimal, getcontext

# 設定精度
getcontext().prec = 10

def get_bybit_funding_rates(assets, retries=3, retry_delay=1):
    # Bybit V5 Tickers 接口
    url = "https://api.bybit.com/v5/market/tickers"
    
    # 統一轉大寫
    target_assets = [a.upper() for a in assets]
    
    # 儲存原始數據的字典
    # linear 包含 USDT 和 USDC 合約; inverse 包含 幣本位(USD)
    raw_data = {"linear": {}, "inverse": {}}

    for attempt in range(1, retries + 1):
        try:
            all_success = True
            for cat in ["linear", "inverse"]:
                res = requests.get(f"{url}?category={cat}", timeout=10)
                if res.status_code == 200:
                    data = res.json()
                    if data.get('retCode') == 0:
                        # 建立以 symbol 為 key 的字典
                        raw_data[cat] = {item['symbol']: item for item in data['result'].get('list', [])}
                    else:
                        all_success = False
                else:
                    all_success = False
            
            if all_success:
                break
        except Exception as e:
            print(f"[Bybit] 第 {attempt} 次錯誤: {e}")
        
        if attempt < retries:
            time.sleep(retry_delay)

    final_results = []
    for coin in target_assets:
        def calculate_rate(category, symbol):
            market = raw_data.get(category, {})
            if symbol in market:
                item = market[symbol]
                raw_rate = Decimal(item.get('fundingRate', 0))
                # Bybit interval 單位是分鐘 (如 480)，轉成小時
                interval_min = Decimal(item.get('fundingInterval', 480))
                interval_hrs = interval_min / 60
                
                # 標準化為 8H
                multiplier = Decimal(8) / interval_hrs
                standardized_rate = (raw_rate * multiplier * Decimal(100))
                return float(standardized_rate.quantize(Decimal('0.00001')))
            return None

        # Bybit 命名規則：
        # USDT: BTCUSDT
        # USDC: BTCPERP (部分幣種為 {COIN}PERP)
        # USD:  BTCUSD (幣本位)
        
        final_results.append({
            "exchange": "Bybit",
            "symbol": coin,
            "USDT_rate": calculate_rate("linear", f"{coin}USDT"),
            "USDC_rate": calculate_rate("linear", f"{coin}PERP"), 
            "USD_rate":  calculate_rate("inverse", f"{coin}USD")
        })

    return final_results

if __name__ == "__main__":
    # 測試執行
    test_assets = ["BTC", "ETH", "SOL", "HYPE", "LIT"]
    result = get_bybit_funding_rates(test_assets)
    print(json.dumps(result, indent=4, ensure_ascii=False))