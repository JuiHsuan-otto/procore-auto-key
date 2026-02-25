from api_monitor import APIResourceManager
import time

class LoadBalancer:
    def __init__(self):
        self.api_manager = APIResourceManager()
        self.task_queue = []
        
    def add_task(self, task_type: str, priority: int = 1):
        self.task_queue.append({
            "type": task_type,
            "priority": priority,
            "timestamp": time.time()
        })
        self.task_queue.sort(key=lambda x: (-x["priority"], x["timestamp"]))
    
    def process_next_task(self):
        if not self.task_queue:
            return None
            
        task = self.task_queue[0]
        model = self._select_model(task["type"])
        
        if self.api_manager.can_use_api(model):
            self.task_queue.pop(0)
            self.api_manager.log_request(model)
            return {"task": task, "model": model}
        else:
            return None
    
    def _select_model(self, task_type: str) -> str:
        task_model_mapping = {
            "code_generation": "claude-3-sonnet",
            "code_review": "claude-3-sonnet",
            "seo_content": "gemini-3-flash-preview",
            "general_chat": "gemini-3-flash-preview"
        }
        return task_model_mapping.get(task_type, "gemini-3-flash-preview")
    
    def get_queue_status(self):
        return {
            "queue_length": len(self.task_queue),
            "high_priority_tasks": sum(1 for task in self.task_queue if task["priority"] > 1),
            "gemini_available": self.api_manager.can_use_api("gemini"),
            "claude_available": self.api_manager.can_use_api("claude")
        }