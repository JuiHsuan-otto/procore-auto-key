from typing import Dict, List, Optional, Callable, Awaitable
import logging
import asyncio
from datetime import datetime
from pathlib import Path

class CommandRegistry:
    def __init__(self):
        self.commands = {}
        self.setup_logging()
        self.register_default_commands()
        
    def setup_logging(self):
        self.logger = logging.getLogger('command_registry')
        self.logger.setLevel(logging.INFO)
        handler = logging.FileHandler('logs/commands.log', encoding='utf-8')
        handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        self.logger.addHandler(handler)
        
    def register_command(self, 
                        name: str, 
                        handler: Callable[[Dict], Awaitable[Dict]], 
                        description: str = ""):
        """註冊新命令"""
        self.commands[name] = {
            "handler": handler,
            "description": description,
            "created_at": datetime.now().isoformat()
        }
        self.logger.info(f"Registered command: {name}")
        
    def register_default_commands(self):
        """註冊預設命令"""
        # 基礎命令
        self.register_command(
            "plan",
            self.handle_plan,
            "生成執行計畫"
        )
        
        self.register_command(
            "tdd",
            self.handle_tdd,
            "TDD 工作流程指導"
        )
        
        self.register_command(
            "code-review",
            self.handle_code_review,
            "程式碼審查"
        )
        
        self.register_command(
            "build-fix",
            self.handle_build_fix,
            "修復建構問題"
        )
        
        self.register_command(
            "e2e",
            self.handle_e2e,
            "執行端對端測試"
        )
        
        # 多智能體協調命令
        self.register_command(
            "multi-plan",
            self.handle_multi_plan,
            "多智能體規劃"
        )
        
        self.register_command(
            "multi-execute",
            self.handle_multi_execute,
            "多智能體執行"
        )
        
        # 學習相關命令
        self.register_command(
            "instinct-status",
            self.handle_instinct_status,
            "檢查學習狀態"
        )
        
        self.register_command(
            "evolve",
            self.handle_evolve,
            "觸發學習進化"
        )
        
    async def handle_plan(self, context: Dict) -> Dict:
        """處理計畫命令"""
        self.logger.info("Executing plan command")
        # 實現計畫邏輯
        return {"status": "planned"}
        
    async def handle_tdd(self, context: Dict) -> Dict:
        """處理 TDD 命令"""
        self.logger.info("Executing TDD command")
        return {"status": "tdd_guided"}
        
    async def handle_code_review(self, context: Dict) -> Dict:
        """處理程式碼審查命令"""
        self.logger.info("Executing code review command")
        return {"status": "reviewed"}
        
    async def handle_build_fix(self, context: Dict) -> Dict:
        """處理建構修復命令"""
        self.logger.info("Executing build fix command")
        return {"status": "fixed"}
        
    async def handle_e2e(self, context: Dict) -> Dict:
        """處理端對端測試命令"""
        self.logger.info("Executing E2E test command")
        return {"status": "tested"}
        
    async def handle_multi_plan(self, context: Dict) -> Dict:
        """處理多智能體規劃命令"""
        self.logger.info("Executing multi-agent planning command")
        return {"status": "multi_planned"}
        
    async def handle_multi_execute(self, context: Dict) -> Dict:
        """處理多智能體執行命令"""
        self.logger.info("Executing multi-agent execution command")
        return {"status": "multi_executed"}
        
    async def handle_instinct_status(self, context: Dict) -> Dict:
        """處理學習狀態檢查命令"""
        self.logger.info("Checking learning status")
        return {"status": "checked"}
        
    async def handle_evolve(self, context: Dict) -> Dict:
        """處理學習進化命令"""
        self.logger.info("Executing evolution command")
        return {"status": "evolved"}
        
    async def execute_command(self, command: str, context: Dict = None) -> Optional[Dict]:
        """執行命令"""
        if context is None:
            context = {}
            
        if command in self.commands:
            try:
                handler = self.commands[command]["handler"]
                result = await handler(context)
                self.logger.info(f"Executed command {command}: {result.get('status')}")
                return result
            except Exception as e:
                self.logger.error(f"Command {command} execution failed: {str(e)}")
                return {"status": "failed", "error": str(e)}
        else:
            self.logger.warning(f"Command not found: {command}")
            return None
            
    def get_command_help(self, command: str) -> Optional[str]:
        """獲取命令說明"""
        if command in self.commands:
            return self.commands[command]["description"]
        return None
        
    def list_commands(self) -> List[Dict]:
        """列出所有可用命令"""
        return [{
            "name": name,
            "description": cmd["description"],
            "created_at": cmd["created_at"]
        } for name, cmd in self.commands.items()]