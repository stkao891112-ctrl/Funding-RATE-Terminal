import requests
import json
from decimal import Decimal, getcontext

# 設定精度
getcontext().prec = 10

def get_backpack_funding_rates(assets):
    """
    從 Backpack 接口抓取費率並強制換算為 8H
    """
    final_data_list = []
    # 統一轉大寫
    target_assets = [a.upper() for a in assets]
    
    for coin in target_assets:
        symbol = f"{coin}_USDC_PERP"
        url = f"https://api.backpack.exchange/api/v1/fundingRates?symbol={symbol}&limit=1"
        
        try:
            # 加入 User-Agent 模擬瀏覽器
            headers = {'User-Agent': 'Mozilla/5.0'}
            response = requests.get(url, headers=headers, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    item = data[0]
                    # 使用 Decimal 進行精準運算
                    raw_rate = Decimal(item['fundingRate'])
                    
                    # 標準化公式：1H 費率 * 8 (變 8H) * 100 (變百分比)
                    standardized_rate = raw_rate * Decimal(8) * Decimal(100)
                    
                    # 格式化：保留小數點後 5 位
                    formatted_rate = float(standardized_rate.quantize(Decimal('0.00001')))
                    
                    final_data_list.append({
                        "exchange": "Backpack",
                        "symbol": coin,
                        "USDC_rate": formatted_rate,
                        "interval": "8H"
                    })
                    continue
            
            # 若 API 回傳空或失敗
            final_data_list.append({"exchange": "Backpack", "symbol": coin, "rate": "N/A", "interval": "8H"})
            
        except Exception as e:
            print(f"❌ Backpack {coin} 抓取錯誤: {e}")
            final_data_list.append({"exchange": "Backpack", "symbol": coin, "rate": "N/A", "interval": "8H"})

    return final_data_list

if __name__ == "__main__":
    # 測試
    print(json.dumps(get_backpack_funding_rates(["BTC", "ETH", "SOL", "HYPE"]), indent=4))