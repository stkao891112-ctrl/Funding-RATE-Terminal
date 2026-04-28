import requests
import json
import time
from decimal import Decimal, getcontext

# 設定精度
getcontext().prec = 10

def get_okx_funding_rates(assets, retries=3, retry_delay=1):
    # 使用你提供的批量接口
    # 註：OKX V5 批量獲取費率的標準路徑通常是 /public/funding-rate-all 
    # 或 /public/funding-rate?instId=ANY (取決於 OKX 具體端點更新)
    url = "https://www.okx.com/api/v5/public/funding-rate?instId=ANY"
    
    target_assets = [a.upper() for a in assets]
    
    # 用於儲存所有從 API 抓回來的資料 (以 instId 為 key)
    all_market_data = {}

    for attempt in range(1, retries + 1):
        try:
            res = requests.get(url, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data.get('code') == '0' and data.get('data'):
                    # 將所有資料轉存入字典，加速後續查找
                    for item in data['data']:
                        all_market_data[item['instId']] = item
                    break 
            else:
                print(f"[OKX] 第 {attempt} 次請求失敗，狀態碼: {res.status_code}")
        except Exception as e:
            print(f"[OKX] 第 {attempt} 次發生錯誤: {e}")
        
        if attempt < retries:
            time.sleep(retry_delay)

    # 封裝結果
    final_results = []
    for coin in target_assets:
        def process_rate(inst_id):
            item = all_market_data.get(inst_id)
            if item:
                try:
                    # 週期與標準化計算
                    next_f = Decimal(item['nextFundingTime'])
                    curr_f = Decimal(item['fundingTime'])
                    diff_ms = next_f - curr_f
                    
                    interval_hrs = diff_ms / Decimal(3600000)
                    if interval_hrs <= 0: interval_hrs = Decimal(8)
                    
                    multiplier = Decimal(8) / interval_hrs
                    raw_rate = Decimal(item['fundingRate'])
                    
                    return float((raw_rate * multiplier * Decimal(100)).quantize(Decimal('0.00001')))
                except:
                    return None
            return None

        final_results.append({
            "exchange": "OKX",
            "symbol": coin,
            "USDT_rate": process_rate(f"{coin}-USDT-SWAP"),
            "USDC_rate": process_rate(f"{coin}-USD_UM-SWAP"),
            "USD_rate":  process_rate(f"{coin}-USD-SWAP")
        })

    return final_results

if __name__ == "__main__":
    # 測試執行
    my_assets = ["BTC", "ETH", "SOL", "HYPE", "LIT"]
    results = get_okx_funding_rates(my_assets)
    print(json.dumps(results, indent=4, ensure_ascii=False))