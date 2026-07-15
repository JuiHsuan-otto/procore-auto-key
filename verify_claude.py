import requests
import json

def test_claude_api(api_key):
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    data = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 10,
        "messages": [{"role": "user", "content": "hi"}]
    }
    try:
        response = requests.post(url, headers=headers, json=data, timeout=15)
        if response.status_code == 200:
            return True, "SUCCESS: API is active and responding."
        else:
            return False, f"FAILED: Status {response.status_code}, Response: {response.text}"
    except Exception as e:
        return False, f"ERROR: {str(e)}"

if __name__ == "__main__":
    # 從 config 讀取 key 確保測試的是系統內存的那一組
    with open('api_keys_config.json', 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    claude_key = next((k['key'] for k in config['keys'] if "sk-ant-api" in k['key']), None)
    
    if claude_key:
        is_ok, msg = test_claude_api(claude_key)
        print(msg)
    else:
        print("ERROR: Claude API Key not found in config.")
