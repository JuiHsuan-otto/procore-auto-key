from typing import Dict, List, Optional
import json
import time
from datetime import datetime, timedelta
import random
import logging

class APIKey:
    def __init__(self, key: str, model: str, project: str):
        self.key = key
        self.model = model  # gemini-pro, gemini-flash, claude-sonnet 等
        self.project = project  # procore, hibou 等
        self.last_used = None
        self.in_cooldown = False
        self.cooldown_until = None
        self.requests_count = 0
        self.errors_count = 0

class LoadBalancer:
    def __init__(self):
        self.keys = self._load_api_keys()
        self.current_index = 0
        self.health_monitor = HealthMonitor()
        self.domain_isolator = DomainIsolator()
        
    def _load_api_keys(self) -> List[APIKey]:
        """從配置文件載入 API Keys"""
        try:
            with open('api_keys_config.json', 'r') as f:
                config = json.load(f)
                return [
                    APIKey(
                        key=k['key'],
                        model=k['model'],
                        project=k['project']
                    ) for k in config['keys']
                ]
        except FileNotFoundError:
            # 示例配置
            return [
                APIKey("key1", "gemini-flash", "procore"),
                APIKey("key2", "gemini-flash", "procore"),
                APIKey("key3", "claude-sonnet", "procore"),
                APIKey("key4", "gemini-flash", "hibou")
            ]

    def get_next_key(self, project: str, task_complexity: str = "normal") -> Optional[APIKey]:
        """根據專案和任務複雜度選擇下一個可用的 Key"""
        available_keys = [
            k for k in self.keys 
            if k.project == project and not self.health_monitor.is_in_cooldown(k)
        ]
        
        if not available_keys:
            return None
            
        if task_complexity == "high":
            # 優先選擇高性能模型
            claude_keys = [k for k in available_keys if k.model == "claude-sonnet"]
            if claude_keys:
                return random.choice(claude_keys)
                
        # 輪詢選擇
        self.current_index = (self.current_index + 1) % len(available_keys)
        return available_keys[self.current_index]

class HealthMonitor:
    def __init__(self):
        self.cooldown_minutes = 2
        self.max_errors = 3
        self.logger = self._setup_logger()
        
    def _setup_logger(self):
        logger = logging.getLogger('api_health')
        logger.setLevel(logging.INFO)
        handler = logging.FileHandler('api_health.log')
        handler.setFormatter(logging.Formatter('%(asctime)s - %(message)s'))
        logger.addHandler(handler)
        return logger
        
    def is_in_cooldown(self, key: APIKey) -> bool:
        """檢查 Key 是否在冷卻狀態"""
        if not key.in_cooldown:
            return False
            
        if datetime.now() >= key.cooldown_until:
            key.in_cooldown = False
            key.cooldown_until = None
            return False
            
        return True
        
    def handle_error(self, key: APIKey, error_type: str):
        """處理 API 錯誤"""
        self.logger.error(f"API Error: {error_type} for key ending in ...{key.key[-4:]}")
        
        if error_type == "rate_limit_reached":
            key.in_cooldown = True
            key.cooldown_until = datetime.now() + timedelta(minutes=self.cooldown_minutes)
            
        elif error_type == "authentication_error":
            key.errors_count += 1
            if key.errors_count >= self.max_errors:
                key.in_cooldown = True
                key.cooldown_until = datetime.now() + timedelta(hours=1)

class DomainIsolator:
    def __init__(self):
        self.sessions: Dict[str, List[str]] = {
            "procore": [],
            "hibou": []
        }
        
    def start_session(self, project: str) -> str:
        """為特定專案開始新的 API session"""
        session_id = f"{project}_{int(time.time())}"
        self.sessions[project].append(session_id)
        return session_id
        
    def clear_old_sessions(self, max_age_hours: int = 24):
        """清理舊的 session 記錄"""
        current_time = time.time()
        for project in self.sessions:
            self.sessions[project] = [
                s for s in self.sessions[project]
                if int(s.split('_')[1]) > current_time - (max_age_hours * 3600)
            ]

class APIResourceManager:
    def __init__(self):
        self.load_balancer = LoadBalancer()
        self.health_monitor = self.load_balancer.health_monitor
        self.domain_isolator = self.load_balancer.domain_isolator
        
    def get_api_key(self, project: str, task_complexity: str = "normal") -> Optional[str]:
        """獲取適合的 API Key"""
        key = self.load_balancer.get_next_key(project, task_complexity)
        if not key:
            return None
            
        session_id = self.domain_isolator.start_session(project)
        key.last_used = datetime.now()
        return key.key
        
    def handle_api_error(self, key: str, error_type: str):
        """處理 API 錯誤"""
        api_key = next((k for k in self.load_balancer.keys if k.key == key), None)
        if api_key:
            self.health_monitor.handle_error(api_key, error_type)
            
    def get_status(self) -> Dict:
        """獲取系統狀態報告"""
        return {
            "total_keys": len(self.load_balancer.keys),
            "available_keys": sum(1 for k in self.load_balancer.keys if not k.in_cooldown),
            "procore_keys": sum(1 for k in self.load_balancer.keys if k.project == "procore"),
            "hibou_keys": sum(1 for k in self.load_balancer.keys if k.project == "hibou")
        }