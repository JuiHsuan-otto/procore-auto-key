import sys
import io
import json
import asyncio
import aiohttp
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

class APIVerifier:
    def __init__(self, config_path='api_keys_config.json'):
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        self.results = []

    async def test_google(self, api_key, model):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {"contents": [{"parts":[{"text": "ping"}]}]}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=10) as resp:
                    text = await resp.text()
                    return resp.status == 200, f"Status: {resp.status} ({text[:50]}...)"
        except Exception as e:
            return False, str(e)

    async def test_openai_compatible(self, api_key, model, base_url):
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {"model": model, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 5}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{base_url}/chat/completions", json=payload, headers=headers, timeout=10) as resp:
                    text = await resp.text()
                    return resp.status == 200, f"Status: {resp.status} ({text[:50]}...)"
        except Exception as e:
            return False, str(e)

    async def run_tests(self):
        print(f"🚀 開始全系統 API 二次壓力測試 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("-" * 80)
        
        tasks = []
        for k in self.config['keys']:
            key_id = f"{k['model']} (...{k['key'][-4:]})"
            
            if "gemini" in k['model']:
                tasks.append(self.wrap_test(key_id, self.test_google(k['key'], k['model'])))
            
            elif "llama" in k['model']:
                tasks.append(self.wrap_test(key_id, self.test_openai_compatible(k['key'], k['model'], "https://api.groq.com/openai/v1")))
            
            elif "gpt" in k['model']:
                tasks.append(self.wrap_test(key_id, self.test_openai_compatible(k['key'], k['model'], "https://models.inference.ai.azure.com")))

            elif "mistral" in k['model']:
                tasks.append(self.wrap_test(key_id, self.test_openai_compatible(k['key'], k['model'], "https://api.mistral.ai/v1")))
            
            else:
                print(f"⚠️ 跳過測試: {key_id}")

        await asyncio.gather(*tasks)
        self.print_summary()

    async def wrap_test(self, name, awaitable):
        success, msg = await awaitable
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {name.ljust(40)} | {msg}")
        self.results.append(success)

    def print_summary(self):
        passed = sum(self.results)
        total = len(self.results)
        print("-" * 80)
        print(f"📊 測試總結: {passed}/{total} 可用")

if __name__ == "__main__":
    verifier = APIVerifier()
    asyncio.run(verifier.run_tests())
