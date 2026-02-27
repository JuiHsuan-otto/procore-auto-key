import requests
import json

def verify_claude_legacy(api_key):
    # 使用最穩定的 Claude 3 Sonnet 名稱進行測試
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    data = {
        "model": "claude-3-sonnet-20240229", 
        "max_tokens": 10,
        "messages": [{"role": "user", "content": "hi"}]
    }
    try:
        response = requests.post(url, headers=headers, json=data, timeout=15)
        if response.status_code == 200:
            return True, "✅ SUCCESS: Claude API 已完全接通，儲值金已入帳！"
        else:
            return False, f"STATUS {response.status_code}: {response.text}"
    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    with open('api_keys_config.json', 'r', encoding='utf-8') as f:
        config = json.load(f)
    claude_key = next((k['key'] for k in config['keys'] if "sk-ant-api" in k['key']), None)
    if claude_key:
        print(verify_claude_legacy(claude_key)[1])
