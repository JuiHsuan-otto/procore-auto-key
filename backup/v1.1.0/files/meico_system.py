from agents import AgentOrchestrator
from skills import SkillRegistry
from commands import CommandRegistry
from hooks import HookManager
from rules import RuleEngine
import logging
import asyncio
from pathlib import Path
from typing import Dict, List

class MeicoSystem:
    def __init__(self):
        # 初始化所有子系統
        self.agent_orchestrator = AgentOrchestrator()
        self.skill_registry = SkillRegistry()
        self.command_registry = CommandRegistry()
        self.hook_manager = HookManager()
        self.rule_engine = RuleEngine()
        
        # 建立必要目錄
        self.setup_directories()
        
        # 設置日誌
        self.setup_logging()
        
    def setup_directories(self):
        """建立必要的目錄結構"""
        directories = [
            "logs",
            "memory",
            "rules",
            "skills/patterns",
            "backups"
        ]
        
        for dir_path in directories:
            Path(dir_path).mkdir(parents=True, exist_ok=True)
            
    def setup_logging(self):
        """設置日誌系統"""
        self.logger = logging.getLogger('meico_system')
        self.logger.setLevel(logging.INFO)
        handler = logging.FileHandler('logs/system.log', encoding='utf-8')
        handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        self.logger.addHandler(handler)
        
    async def process_task(self, task: Dict) -> Dict:
        """處理任務的主要流程"""
        self.logger.info(f"Processing task: {task.get('title', 'Untitled')}")
        
        try:
            # 1. 驗證規則
            rule_results = self.rule_engine.validate_all(task)
            if not all(rule_results.values()):
                self.logger.warning("Rule validation failed")
                return {"status": "failed", "reason": "rule_validation_failed"}
                
            # 2. 執行代理人工作流程
            workflow_result = await self.agent_orchestrator.plan_and_execute(task)
            
            # 3. 應用必要的技能
            if "required_skills" in task:
                skill_results = await self.skill_registry.execute_workflow(
                    [{"skill": skill, "context": task} for skill in task["required_skills"]]
                )
                workflow_result["skill_results"] = skill_results
                
            # 4. 觸發相關鉤子
            await self.hook_manager.trigger_event("task_complete", {
                "task": task,
                "result": workflow_result
            })
            
            self.logger.info(f"Task completed: {task.get('title', 'Untitled')}")
            return workflow_result
            
        except Exception as e:
            self.logger.error(f"Task processing failed: {str(e)}")
            return {"status": "failed", "error": str(e)}
            
    async def execute_command(self, command: str, context: Dict = None) -> Dict:
        """執行命令"""
        self.logger.info(f"Executing command: {command}")
        return await self.command_registry.execute_command(command, context)
        
    def get_system_status(self) -> Dict:
        """獲取系統狀態"""
        return {
            "agents": len(self.agent_orchestrator.agents),
            "skills": len(self.skill_registry.skills),
            "commands": len(self.command_registry.commands),
            "rules": len(self.rule_engine.rules)
        }

async def main():
    # 初始化系統
    system = MeicoSystem()
    
    # 示例任務
    task = {
        "title": "實現新功能",
        "type": "feature",
        "language": "python",
        "required_skills": ["python", "testing", "api_design"],
        "description": "實現新的 API 端點"
    }
    
    # 處理任務
    result = await system.process_task(task)
    print(f"Task result: {result}")
    
    # 執行命令
    command_result = await system.execute_command("plan", {"task": task})
    print(f"Command result: {command_result}")
    
    # 顯示系統狀態
    status = system.get_system_status()
    print(f"System status: {status}")

if __name__ == "__main__":
    asyncio.run(main())