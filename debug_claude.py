import requests
import json

def check_available_models(api_key):
    # 既然 404 找不到 model，我們先嘗試呼叫一個無效 model 讓它噴出正確清單（或者測試 3.5 Sonnet）
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    # 嘗試官方標準名稱
    data = {
        "model": "claude-3-5-sonnet-20240620", 
        "max_tokens": 10,
        "messages": [{"role": "user", "content": "hi"}]
    }
    try:
        response = requests.post(url, headers=headers, json=data, timeout=15)
        return response.status_code, response.text
    except Exception as e:
        return 0, str(e)

if __name__ == "__main__":
    with open('api_keys_config.json', 'r', encoding='utf-8') as f:
        config = json.load(f)
    claude_key = next((k['key'] for k in config['keys'] if "sk-ant-api" in k['key']), None)
    if claude_key:
        code, msg = check_available_models(claude_key)
        print(f"CODE: {code}")
        print(f"MSG: {msg}")
