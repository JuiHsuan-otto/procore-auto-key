from typing import Dict, List, Optional
import json
import time
from datetime import datetime, timedelta
import random
import logging
import os

class APIKey:
    def __init__(self, key: str, model: str, project: str, daily_limit: int = 500, priority: int = 10):
        self.key = key
        self.model = model
        self.project = project
        self.daily_limit = daily_limit
        self.priority = priority # 優先級：越小越先用
        self.last_used = None
        self.in_cooldown = False
        self.cooldown_until = None
        self.requests_count = 0
        self.total_usage_today = 0

class LoadBalancer:
    def __init__(self):
        self.usage_log_path = "logs/api_usage_stats.json"
        self.keys = self._load_api_keys()
        self.current_index = 0
        self.health_monitor = HealthMonitor()
        self.domain_isolator = DomainIsolator()
        self._sync_daily_usage()
        
    def _load_api_keys(self) -> List[APIKey]:
        """從配置文件載入 API Keys，並注入限額與優先級"""
        try:
            with open('api_keys_config.json', 'r', encoding='utf-8') as f:
                config = json.load(f)
                limits = config.get('global_limits', {})
                return [
                    APIKey(
                        key=k['key'],
                        model=k['model'],
                        project=k['project'],
                        daily_limit=limits.get(k['model'], 500),
                        priority=k.get('priority', 10)
                    ) for k in config['keys']
                ]
        except:
            return []

    def _sync_daily_usage(self):
        """從日誌同步今日已使用的流量"""
        if not os.path.exists("logs"): os.makedirs("logs")
        today = datetime.now().strftime("%Y-%m-%d")
        if os.path.exists(self.usage_log_path):
            with open(self.usage_log_path, 'r') as f:
                data = json.load(f)
                today_stats = data.get(today, {})
                for key_obj in self.keys:
                    # 使用 Key 的末四位作為唯一辨識碼記錄
                    key_id = key_obj.key[-4:]
                    key_obj.total_usage_today = today_stats.get(key_id, 0)

    def update_usage_log(self, key_obj: APIKey):
        """更新並持久化流量數據"""
        today = datetime.now().strftime("%Y-%m-%d")
        key_id = key_obj.key[-4:]
        
        stats = {}
        if os.path.exists(self.usage_log_path):
            with open(self.usage_log_path, 'r') as f:
                stats = json.load(f)
        
        if today not in stats: stats[today] = {}
        stats[today][key_id] = key_obj.total_usage_today
        
        with open(self.usage_log_path, 'w') as f:
            json.dump(stats, f, indent=2)

    def get_next_key(self, project: str, task_complexity: str = "normal") -> Optional[APIKey]:
        """攔截超額 Key"""
        # 1. 過濾專案與健康狀況
        # 2. 過濾超過今日限額的 Key (熔斷關鍵)
        available_keys = [
            k for k in self.keys 
            if k.project == project 
            and not self.health_monitor.is_in_cooldown(k)
            and k.total_usage_today < k.daily_limit
        ]
        
        if not available_keys:
            print(f"[嚴重警報] 專案 {project} 今日所有 API 額度已耗盡或處於冷卻！")
            return None
            
        # 智慧路由：非高複雜度任務禁止使用 Claude (省錢路徑)
        if task_complexity != "high":
            flash_keys = [k for k in available_keys if "flash" in k.model]
            if flash_keys:
                available_keys = flash_keys

        # 優先級調度：選擇優先級數值最小且未超額的群組
        min_priority = min(k.priority for k in available_keys)
        priority_group = [k for k in available_keys if k.priority == min_priority]

        # 在同優先級群組中隨機輪詢以分散壓力
        key = random.choice(priority_group)
        key.total_usage_today += 1
        self.update_usage_log(key)
        return key

class HealthMonitor:
    def __init__(self):
        self.cooldown_minutes = 2
        self.max_errors = 3
        
    def is_in_cooldown(self, key: APIKey) -> bool:
        if not key.in_cooldown: return False
        if datetime.now() >= key.cooldown_until:
            key.in_cooldown = False
            return False
        return True
        
    def handle_error(self, key: APIKey, error_type: str):
        if error_type == "rate_limit_reached":
            key.in_cooldown = True
            key.cooldown_until = datetime.now() + timedelta(minutes=self.cooldown_minutes)

class DomainIsolator:
    def __init__(self):
        self.sessions = {"procore": [], "hibou": []}
    def start_session(self, project: str) -> str:
        return f"{project}_{int(time.time())}"

class APIResourceManager:
    def __init__(self):
        self.load_balancer = LoadBalancer()
        
    def get_api_key(self, project: str, task_complexity: str = "normal") -> Optional[str]:
        key_obj = self.load_balancer.get_next_key(project, task_complexity)
        return key_obj.key if key_obj else None
        
    def get_report(self):
        """回報今日消耗狀況"""
        report = []
        for k in self.load_balancer.keys:
            report.append(f"[{k.project}] {k.model}(...{k.key[-4:]}): {k.total_usage_today}/{k.daily_limit}")
        return "\n".join(report)

if __name__ == "__main__":
    arm = APIResourceManager()
    print("--- 今日 API 流量監控報告 ---")
    print(arm.get_report())
