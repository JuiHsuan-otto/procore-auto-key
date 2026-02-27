from system_guardian import SystemGuardian
from seo_tracker import SEOTracker
from api_resource_manager import APIResourceManager
import asyncio
import logging
import sys
from pathlib import Path

def setup_global_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('openclaw_system.log', encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )

async def main():
    # 初始化系統守護
    guardian = SystemGuardian()
    workspace = guardian.find_workspace()
    
    # 確保工作目錄存在
    if not workspace.exists():
        print("錯誤：找不到工作目錄")
        return
        
    # 初始化各個系統
    api_manager = APIResourceManager()
    seo_tracker = SEOTracker()
    
    # 創建必要的目錄
    for dir_name in ['backups', 'seo_data', 'logs']:
        (workspace / dir_name).mkdir(exist_ok=True)
    
    # 執行 SEO 檢查
    await seo_tracker.run_daily_check()
    
    # 檢查系統狀態
    status = api_manager.get_status()
    logging.info(f"API 系統狀態: {status}")

if __name__ == "__main__":
    setup_global_logging()
    asyncio.run(main())