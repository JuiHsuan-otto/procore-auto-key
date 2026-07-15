from api_resource_manager import APIResourceManager
import time
import logging

# 設置日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    filename='api_usage.log'
)

def main():
    # 初始化資源管理器
    manager = APIResourceManager()
    
    # 示例 1: 處理極致核心的技術文章
    try:
        key = manager.get_api_key("procore", "high")
        if key:
            logging.info("Using Key %s for ProCore technical article", key[-4:])
            # 模擬 API 調用
            time.sleep(1)
    except Exception as e:
        logging.error("Error processing ProCore article: %s", str(e))
        manager.handle_api_error(key, "rate_limit_reached")
        
    # 示例 2: 處理喜福的品牌文案
    try:
        key = manager.get_api_key("hibou", "normal")
        if key:
            logging.info("Using Key %s for HiBOU brand content", key[-4:])
            # 模擬 API 調用
            time.sleep(1)
    except Exception as e:
        logging.error("Error processing HiBOU content: %s", str(e))
        manager.handle_api_error(key, "authentication_error")
    
    # 獲取系統狀態
    status = manager.get_status()
    logging.info("System status: %s", status)

if __name__ == "__main__":
    main()