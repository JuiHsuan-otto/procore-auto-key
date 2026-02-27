from typing import Dict, List, Optional
import logging
from pathlib import Path
import json
from abc import ABC, abstractmethod

class BaseSkill(ABC):
    def __init__(self, name: str):
        self.name = name
        self.setup_logging()
        
    def setup_logging(self):
        self.logger = logging.getLogger(f'skill.{self.name}')
        self.logger.setLevel(logging.INFO)
        handler = logging.FileHandler(f'logs/skill_{self.name}.log', encoding='utf-8')
        handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        self.logger.addHandler(handler)
        
    @abstractmethod
    async def execute(self, context: Dict) -> Dict:
        pass

class LanguageSkill(BaseSkill):
    """語言特定技能"""
    def __init__(self, language: str):
        super().__init__(f"{language}_skill")
        self.language = language
        self.load_patterns()
        
    def load_patterns(self):
        """載入語言特定的模式"""
        patterns_file = Path(f"skills/patterns/{self.language}.json")
        if patterns_file.exists():
            with open(patterns_file, 'r', encoding='utf-8') as f:
                self.patterns = json.load(f)
        else:
            self.patterns = {}
            
    async def execute(self, context: Dict) -> Dict:
        self.logger.info(f"Executing {self.language} skill")
        return {"status": "executed", "language": self.language}

class TestingSkill(BaseSkill):
    """測試相關技能"""
    def __init__(self):
        super().__init__("testing")
        
    async def execute(self, context: Dict) -> Dict:
        self.logger.info("Executing testing skill")
        return {"status": "executed", "type": "testing"}

class SecuritySkill(BaseSkill):
    """安全性相關技能"""
    def __init__(self):
        super().__init__("security")
        
    async def execute(self, context: Dict) -> Dict:
        self.logger.info("Executing security skill")
        return {"status": "executed", "type": "security"}

class DeploymentSkill(BaseSkill):
    """部署相關技能"""
    def __init__(self):
        super().__init__("deployment")
        
    async def execute(self, context: Dict) -> Dict:
        self.logger.info("Executing deployment skill")
        return {"status": "executed", "type": "deployment"}

class APIDesignSkill(BaseSkill):
    """API 設計技能"""
    def __init__(self):
        super().__init__("api_design")
        
    async def execute(self, context: Dict) -> Dict:
        self.logger.info("Executing API design skill")
        return {"status": "executed", "type": "api_design"}

class DatabaseSkill(BaseSkill):
    """資料庫相關技能"""
    def __init__(self):
        super().__init__("database")
        
    async def execute(self, context: Dict) -> Dict:
        self.logger.info("Executing database skill")
        return {"status": "executed", "type": "database"}

class DockerSkill(BaseSkill):
    """Docker 相關技能"""
    def __init__(self):
        super().__init__("docker")
        
    async def execute(self, context: Dict) -> Dict:
        self.logger.info("Executing Docker skill")
        return {"status": "executed", "type": "docker"}

class LLMPipelineSkill(BaseSkill):
    """LLM 管線技能"""
    def __init__(self):
        super().__init__("llm_pipeline")
        
    async def execute(self, context: Dict) -> Dict:
        self.logger.info("Executing LLM pipeline skill")
        return {"status": "executed", "type": "llm_pipeline"}

class ContentCacheSkill(BaseSkill):
    """內容快取技能"""
    def __init__(self):
        super().__init__("content_cache")
        
    async def execute(self, context: Dict) -> Dict:
        self.logger.info("Executing content cache skill")
        return {"status": "executed", "type": "content_cache"}

class SkillRegistry:
    """技能註冊表"""
    def __init__(self):
        self.skills = {}
        self.setup_logging()
        self.register_default_skills()
        
    def setup_logging(self):
        self.logger = logging.getLogger('skill_registry')
        self.logger.setLevel(logging.INFO)
        handler = logging.FileHandler('logs/skill_registry.log', encoding='utf-8')
        handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        self.logger.addHandler(handler)
        
    def register_default_skills(self):
        """註冊預設技能"""
        # 語言技能
        for lang in ["typescript", "python", "go", "java", "cpp"]:
            self.register_skill(f"{lang}", LanguageSkill(lang))
            
        # 框架技能
        for framework in ["django", "spring"]:
            self.register_skill(f"{framework}", LanguageSkill(framework))
            
        # 其他技能
        self.register_skill("testing", TestingSkill())
        self.register_skill("security", SecuritySkill())
        self.register_skill("deployment", DeploymentSkill())
        self.register_skill("api_design", APIDesignSkill())
        self.register_skill("database", DatabaseSkill())
        self.register_skill("docker", DockerSkill())
        self.register_skill("llm_pipeline", LLMPipelineSkill())
        self.register_skill("content_cache", ContentCacheSkill())
        
    def register_skill(self, name: str, skill: BaseSkill):
        """註冊新技能"""
        self.skills[name] = skill
        self.logger.info(f"Registered skill: {name}")
        
    async def execute_skill(self, name: str, context: Dict) -> Optional[Dict]:
        """執行特定技能"""
        if name in self.skills:
            try:
                result = await self.skills[name].execute(context)
                self.logger.info(f"Executed skill {name}: {result.get('status')}")
                return result
            except Exception as e:
                self.logger.error(f"Skill {name} execution failed: {str(e)}")
                return {"status": "failed", "error": str(e)}
        else:
            self.logger.warning(f"Skill not found: {name}")
            return None
            
    async def execute_workflow(self, workflow: List[Dict]) -> List[Dict]:
        """執行技能工作流程"""
        results = []
        for step in workflow:
            skill_name = step.get("skill")
            context = step.get("context", {})
            result = await self.execute_skill(skill_name, context)
            results.append(result)
        return results