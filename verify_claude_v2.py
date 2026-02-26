import requests
import json

def verify_claude_latest(api_key):
    # 使用確定的最新模型名稱測試
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    data = {
        "model": "claude-3-5-sonnet-latest", # 改用 latest 別名
        "max_tokens": 10,
        "messages": [{"role": "user", "content": "hi"}]
    }
    try:
        response = requests.post(url, headers=headers, json=data, timeout=15)
        if response.status_code == 200:
            return True, "✅ SUCCESS: Claude API 已經成功活化！儲值金已生效。"
        else:
            return False, f"FAILED {response.status_code}: {response.text}"
    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    with open('api_keys_config.json', 'r', encoding='utf-8') as f:
        config = json.load(f)
    claude_key = next((k['key'] for k in config['keys'] if "sk-ant-api" in k['key']), None)
    if claude_key:
        is_ok, msg = verify_claude_latest(claude_key)
        print(msg)
