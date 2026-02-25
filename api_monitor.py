from typing import Dict, List, Optional
import json
import time
from datetime import datetime, timedelta

class APIResourceManager:
    def __init__(self):
        self.config = {
            "primary": {
                "model": "gemini-3-flash-preview",
                "max_rpm": 60,  # 每分鐘請求數
                "cooldown_minutes": 2
            },
            "backup": {
                "model": "claude-3-sonnet",
                "max_rpm": 30,
                "cooldown_minutes": 5
            }
        }
        
        self.usage_log = {
            "gemini": {"requests": [], "in_cooldown": False},
            "claude": {"requests": [], "in_cooldown": False}
        }

    def can_use_api(self, model: str) -> bool:
        current_time = datetime.now()
        model_key = "gemini" if "gemini" in model else "claude"
        
        # 清理舊的請求記錄
        self.usage_log[model_key]["requests"] = [
            req_time for req_time in self.usage_log[model_key]["requests"]
            if current_time - req_time < timedelta(minutes=1)
        ]
        
        # 檢查是否在冷卻期
        if self.usage_log[model_key]["in_cooldown"]:
            last_request = max(self.usage_log[model_key]["requests"]) if self.usage_log[model_key]["requests"] else current_time
            cooldown_time = self.config["primary" if "gemini" in model else "backup"]["cooldown_minutes"]
            if current_time - last_request >= timedelta(minutes=cooldown_time):
                self.usage_log[model_key]["in_cooldown"] = False
            else:
                return False
        
        # 檢查每分鐘請求限制
        max_rpm = self.config["primary" if "gemini" in model else "backup"]["max_rpm"]
        if len(self.usage_log[model_key]["requests"]) >= max_rpm:
            self.usage_log[model_key]["in_cooldown"] = True
            return False
            
        return True

    def log_request(self, model: str):
        model_key = "gemini" if "gemini" in model else "claude"
        self.usage_log[model_key]["requests"].append(datetime.now())

    def get_best_available_model(self) -> str:
        if self.can_use_api("gemini"):
            return "gemini-3-flash-preview"
        elif self.can_use_api("claude"):
            return "claude-3-sonnet"
        else:
            # 兩個模型都在冷卻，選擇剩餘冷卻時間最短的
            gemini_cooldown = self._get_remaining_cooldown("gemini")
            claude_cooldown = self._get_remaining_cooldown("claude")
            return "gemini-3-flash-preview" if gemini_cooldown <= claude_cooldown else "claude-3-sonnet"

    def _get_remaining_cooldown(self, model_key: str) -> int:
        if not self.usage_log[model_key]["requests"]:
            return 0
        
        last_request = max(self.usage_log[model_key]["requests"])
        cooldown_time = self.config["primary" if model_key == "gemini" else "backup"]["cooldown_minutes"]
        remaining = cooldown_time - (datetime.now() - last_request).total_seconds() / 60
        return max(0, int(remaining))

# 配置文件
def save_config():
    config = {
        "api_resource_manager": {
            "version": "1.0.0",
            "last_updated": datetime.now().isoformat(),
            "models": {
                "gemini-3-flash-preview": {
                    "priority": 1,
                    "max_rpm": 60,
                    "cooldown_minutes": 2
                },
                "claude-3-sonnet": {
                    "priority": 2,
                    "max_rpm": 30,
                    "cooldown_minutes": 5
                }
            }
        }
    }
    
    with open("system_config.json", "w") as f:
        json.dump(config, f, indent=2)

# 監控指標
def save_usage_metrics(manager: APIResourceManager):
    metrics = {
        "timestamp": datetime.now().isoformat(),
        "gemini_requests_last_minute": len(manager.usage_log["gemini"]["requests"]),
        "claude_requests_last_minute": len(manager.usage_log["claude"]["requests"]),
        "gemini_in_cooldown": manager.usage_log["gemini"]["in_cooldown"],
        "claude_in_cooldown": manager.usage_log["claude"]["in_cooldown"]
    }
    
    with open("api_usage.log", "a") as f:
        f.write(json.dumps(metrics) + "\n")