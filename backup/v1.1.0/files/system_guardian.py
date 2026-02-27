import sys
import os
import locale
import codecs
import logging
from typing import Optional, List
from pathlib import Path

class SystemGuardian:
    def __init__(self):
        self.workspace = Path(r'C:\Users\ottoy\.openclaw\workspace')
        self.setup_logging()
        self.fix_encoding()
        
    def setup_logging(self):
        self.logger = logging.getLogger('system_guardian')
        self.logger.setLevel(logging.INFO)
        handler = logging.FileHandler('system_guardian.log', encoding='utf-8')
        handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        self.logger.addHandler(handler)

    def fix_encoding(self):
        """修正 Windows PowerShell 的編碼問題"""
        if sys.platform == 'win32':
            try:
                sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer)
                sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer)
                os.environ['PYTHONIOENCODING'] = 'utf-8'
                self.logger.info("已修正 Windows 編碼設置")
            except Exception as e:
                self.logger.error(f"編碼修正失敗: {str(e)}")

    def find_workspace(self) -> Path:
        """自動尋找並修正工作目錄"""
        if not self.workspace.exists():
            possible_paths = [
                Path.home() / '.openclaw' / 'workspace',
                Path.cwd(),
                Path('C:/Users/ottoy/.openclaw/workspace')
            ]
            
            for path in possible_paths:
                if path.exists():
                    self.workspace = path
                    self.logger.info(f"找到工作目錄: {path}")
                    return path
                    
            self.logger.error("無法找到有效的工作目錄")
            raise FileNotFoundError("找不到工作目錄")
            
        return self.workspace

    def safe_read(self, file_path: str, encoding='utf-8') -> Optional[str]:
        """安全讀取文件，自動處理編碼問題"""
        try:
            full_path = self.workspace / file_path
            with open(full_path, 'r', encoding=encoding) as f:
                return f.read()
        except UnicodeDecodeError:
            # 嘗試其他編碼
            encodings = ['utf-8-sig', 'big5', 'gbk', 'latin1']
            for enc in encodings:
                try:
                    with open(full_path, 'r', encoding=enc) as f:
                        content = f.read()
                        self.logger.info(f"使用 {enc} 編碼成功讀取文件")
                        return content
                except UnicodeDecodeError:
                    continue
            self.logger.error(f"無法讀取文件 {file_path}")
            return None

    def safe_write(self, file_path: str, content: str, encoding='utf-8') -> bool:
        """安全寫入文件，自動創建目錄"""
        try:
            full_path = self.workspace / file_path
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(full_path, 'w', encoding=encoding) as f:
                f.write(content)
            self.logger.info(f"成功寫入文件: {file_path}")
            return True
        except Exception as e:
            self.logger.error(f"寫入文件失敗 {file_path}: {str(e)}")
            return False

    def create_backup(self, file_path: str) -> Optional[str]:
        """創建文件備份"""
        try:
            source_path = self.workspace / file_path
            if not source_path.exists():
                self.logger.error(f"要備份的文件不存在: {file_path}")
                return None
                
            backup_path = source_path.parent / f"{source_path.stem}_stable{source_path.suffix}.bak"
            with open(source_path, 'r', encoding='utf-8') as source:
                with open(backup_path, 'w', encoding='utf-8') as backup:
                    backup.write(source.read())
                    
            self.logger.info(f"已創建備份: {backup_path}")
            return str(backup_path)
        except Exception as e:
            self.logger.error(f"創建備份失敗: {str(e)}")
            return None

    def restore_from_backup(self, file_path: str) -> bool:
        """從備份恢復文件"""
        try:
            source_path = self.workspace / f"{file_path[:-5]}"  # 移除 .bak
            backup_path = self.workspace / file_path
            
            if not backup_path.exists():
                self.logger.error(f"備份文件不存在: {file_path}")
                return False
                
            with open(backup_path, 'r', encoding='utf-8') as backup:
                with open(source_path, 'w', encoding='utf-8') as source:
                    source.write(backup.read())
                    
            self.logger.info(f"已從備份恢復: {source_path}")
            return True
        except Exception as e:
            self.logger.error(f"恢復備份失敗: {str(e)}")
            return False

    def list_backups(self) -> List[str]:
        """列出所有備份文件"""
        try:
            backups = list(self.workspace.glob('**/*.bak'))
            return [str(b.relative_to(self.workspace)) for b in backups]
        except Exception as e:
            self.logger.error(f"列出備份失敗: {str(e)}")
            return []