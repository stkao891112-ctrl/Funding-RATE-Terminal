import requests
import json
import time

def get_binance_funding_rates(assets, retries=3, retry_delay=1):
    # --- 接口定義 ---
    # U本位 (USDT & USDC)
    u_premium_url = 'https://fapi.binance.com/fapi/v1/premiumIndex'
    u_info_url    = 'https://fapi.binance.com/fapi/v1/fundingInfo'
    # 幣本位 (USD)
    d_premium_url = 'https://dapi.binance.com/dapi/v1/premiumIndex'
    d_info_url    = 'https://dapi.binance.com/dapi/v1/fundingInfo'

    if isinstance(assets, str):
        assets = [assets.upper()]
    else:
        assets = [a.upper() for a in assets]

    for attempt in range(1, retries + 1):
        try:
            # 1. 抓取所有資料
            u_p_res = requests.get(u_premium_url, timeout=10)
            u_i_res = requests.get(u_info_url, timeout=10)
            d_p_res = requests.get(d_premium_url, timeout=10)
            d_i_res = requests.get(d_info_url, timeout=10)

            if all(r.status_code == 200 for r in [u_p_res, u_i_res, d_p_res, d_i_res]):
                # 2. 解析 JSON
                u_p_data = u_p_res.json()
                u_i_data = u_i_res.json()
                d_p_data = d_p_res.json()
                d_i_data = d_i_res.json()

                # 3. 建立間隔映射 (判斷幾小時收一次費)
                # U本位 map
                u_interval_map = {item['symbol']: item['fundingIntervalHours'] for item in u_i_data}
                # 幣本位 map (如果 fundingInfo 是空的 []，代表全部都是預設 8 小時)
                d_interval_map = {item['symbol']: item['fundingIntervalHours'] for item in d_i_data}

                # 4. 建立資料映射 (以 Symbol 為 Key)
                u_data_map = {item['symbol']: item for item in u_p_data}
                d_data_map = {item['symbol']: item for item in d_p_data}

                final_data_list = []
                for coin in assets:
                    # 定義內部處理函式，避免重複代碼
                    def calculate_std_rate(symbol, source_map, interval_map):
                        if symbol in source_map:
                            item = source_map[symbol]
                            raw_rate = float(item.get('lastFundingRate', 0))
                            interval = interval_map.get(symbol, 8) # 找不到預設 8
                            multiplier = 8 / interval
                            return round(raw_rate * multiplier * 100, 5)
                        return None

                    # 抓取三種費率
                    usdt_rate = calculate_std_rate(f"{coin}USDT", u_data_map, u_interval_map)
                    usdc_rate = calculate_std_rate(f"{coin}USDC", u_data_map, u_interval_map)
                    usd_rate  = calculate_std_rate(f"{coin}USD_PERP", d_data_map, d_interval_map)

                    final_data_list.append({
                        "exchange": "Binance",
                        "symbol": coin,
                        "USDT_rate": usdt_rate,
                        "USDC_rate": usdc_rate,
                        "USD_rate":  usd_rate  # 幣本位
                    })

                return final_data_list

            else:
                print(f"[Binance] 第 {attempt} 次請求失敗，檢查網路或狀態碼")

        except Exception as e:
            print(f"[Binance] 第 {attempt} 次錯誤: {e}")

        if attempt < retries:
            time.sleep(retry_delay)

    return [{"exchange": "Binance", "symbol": coin, "rate": "N/A"} for coin in assets]

if __name__ == "__main__":
    # HYPE 目前主要在 USDT 市場，幣本位可能為 None
    test_assets = ["BTC", "ETH", "SOL", "HYPE", "LIT"]
    result = get_binance_funding_rates(test_assets)
    print(json.dumps(result, indent=4))