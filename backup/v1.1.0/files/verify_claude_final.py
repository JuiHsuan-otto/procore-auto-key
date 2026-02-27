import requests
import json

def verify_claude_balance(api_key):
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
            return True, "SUCCESS: API is LIVE and balance is active."
        else:
            return False, f"STATUS {response.status_code}: {response.text}"
    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    with open('api_keys_config.json', 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    claude_key = next((k['key'] for k in config['keys'] if "sk-ant-api" in k['key']), None)
    
    if claude_key:
        is_ok, msg = verify_claude_balance(claude_key)
        print(msg)
    else:
        print("ERROR: Claude API Key not found.")
