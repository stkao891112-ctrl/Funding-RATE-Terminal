import requests
import json
from decimal import Decimal, getcontext, ROUND_HALF_UP

# 設定全域精度（30 位有效數字足以處理加密貨幣所有小數位）
getcontext().prec = 30

def get_hyperliquid_funding_rates(assets):
    """
    使用 Decimal 進行極高精度換算，完全捨棄 float
    """
    final_data_list = []
    target_assets = [a.upper() for a in assets]
    
    url = "https://api.hyperliquid.xyz/info" 
    payload = {"type": "predictedFundings"}
    
    try:
        response = requests.post(url, json=payload, timeout=5)
        if response.status_code == 200:
            raw_data = response.json()
            
            for coin in target_assets:
                found_record = None
                
                # 遍歷聚合結構
                for entry in raw_data:
                    # 確保 entry 是列表且第一個元素匹配幣種
                    if isinstance(entry, list) and len(entry) >= 2 and str(entry[0]).upper() == coin:
                        exchanges_list = entry[1]
                        
                        # 尋找 HlPerp
                        for ex_info in exchanges_list:
                            if isinstance(ex_info, list) and ex_info[0] == "HlPerp":
                                details = ex_info[1]
                                
                                # --- 極高精度計算開始 ---
                                # 1. 轉化為字串後存入 Decimal
                                raw_rate = Decimal(str(details['fundingRate']))
                                interval_hours = Decimal(str(details.get('fundingIntervalHours', '1')))
                                
                                # 2. 計算公式：(raw_rate / interval_hours) * 8 * 100
                                # 先除以結算小時算出 1H 費率，再乘以 8 變成 8H，最後乘以 100 轉為百分比單位
                                rate_8h_percent = (raw_rate / interval_hours) * Decimal('8') * Decimal('100')
                                
                                # 3. 四捨五入到小數點後 8 位 (確保比一般交易所更精確)
                                found_record = rate_8h_percent.quantize(Decimal('0.00001'), rounding=ROUND_HALF_UP)
                                break
                        if found_record: break
                
                # 輸出格式
                final_data_list.append({
                    "exchange": "Hyperliquid",
                    "symbol": coin,
                    "USDC_rate": str(found_record) if found_record is not None else "N/A",
                    "interval": "8H"
                })
        else:
            for coin in target_assets:
                final_data_list.append({"exchange": "Hyperliquid", "symbol": coin, "rate": "N/A", "interval": "8H"})
                
    except Exception as e:
        print(f"❌ 高精度解析失敗: {e}")
        for coin in target_assets:
            final_data_list.append({"exchange": "Hyperliquid", "symbol": coin, "rate": "N/A", "interval": "8H"})

    return final_data_list

if __name__ == "__main__":
    # 測試 BTC, 0G 等幣種
    test_coins = ["BTC", "ETH", "SOL", "HYPE"]
    precise_results = get_hyperliquid_funding_rates(test_coins)
    
    # 為了顯示精確度，不使用 float 轉換
    print(json.dumps(precise_results, indent=4))