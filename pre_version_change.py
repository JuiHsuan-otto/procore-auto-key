#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import shutil
import argparse
import io
import re
from datetime import datetime
from typing import Dict, List, Optional

# 強制設置標準輸出為 UTF-8 編碼
if sys.platform.startswith('win'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

MARKERS = {'ok': '[OK] ', 'warn': '[!!] ', 'err': '[XX] ', 'step': '>> ', 'info': '-- '}
VERSION_CHECKS = {
    'major': ['核心架構完整性', '所有資產狀態', '全站路由設定', '資料庫遷移', 'API端點設定'],
    'minor': ['新增功能測試', '資產引用檢查', '路由可達性'],
    'patch': ['修復驗證', '基本功能檢查']
}

def safe_log(msg: str, marker_key: str = 'info', dry_run: bool = False):
    prefix = '[DRY RUN] ' if dry_run else ''
    marker = MARKERS.get(marker_key, '')
    print(f"{prefix}{marker}{msg}")

class MemorySynchronizer:
    """自動更新 MEMORY.md 的核心模組"""
    def __init__(self, memory_path: str = "MEMORY.md"):
        self.path = memory_path

    def update_version_history(self, version: str, level: str, timestamp: str, assets: Dict, git_hash: str):
        if not os.path.exists(self.path): return
        
        with open(self.path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 準備插入的 Markdown 區塊
        new_entry = f"""### {version} — {timestamp.split(' ')[0]}
- **說明**：自動備份 ({level.upper()} Update)
- **重要文章**：已掃描 {len(assets['documents'])} 份文件
- **關鍵資產**：🖼️ {len(assets['images'])} Images, 🎥 {len(assets['videos'])} Videos
- **備份位置**：`/backups/snapshots/{version}/`
- **Git Hash**：`{git_hash}`

"""
        # 尋找插入點：在 "## 📌 版本歷史" 的說明文字之後
        placeholder = "每次重大版本切換前必須新增一筆記錄"
        if placeholder in content:
            updated_content = content.replace(placeholder, f"{placeholder}\n\n{new_entry}")
            with open(self.path, 'w', encoding='utf-8') as f:
                f.write(updated_content)
            return True
        return False

class VersionManager:
    def __init__(self, version: str, level: str, dry_run: bool = False):
        self.version = version
        self.level = level
        self.dry_run = dry_run
        self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.backup_dir = f"backups/snapshots/{version}"
        self.syncer = MemorySynchronizer()
        
    def confirm_major_version(self) -> bool:
        if self.level != 'major': return True
        safe_log("警告：重大版本更新！", 'warn', self.dry_run)
        if not self.dry_run:
            try:
                confirm = input("\n確定繼續嗎？(y/N): ")
                return confirm.lower() == 'y'
            except EOFError: return False
        return True
        
    def scan_assets(self) -> Dict:
        safe_log("開始掃描資產...", 'step', self.dry_run)
        assets = {'images': [], 'videos': [], 'documents': []}
        # 實作掃描 (與前版相同但更嚴謹)
        for root, dirs, files in os.walk('.'):
            if any(x in root for x in ['.git', 'node_modules', 'backups', 'backup']): continue
            for f in files:
                path = os.path.join(root, f)
                if f.lower().endswith(('.jpg', '.png', '.gif', '.webp')): assets['images'].append(path)
                elif f.lower().endswith(('.mp4', '.webm')): assets['videos'].append(path)
                elif f.lower().endswith(('.html', '.md')): assets['documents'].append(path)
        safe_log(f"找到 {len(assets['images'])} 圖片, {len(assets['videos'])} 影片, {len(assets['documents'])} 文件", 'ok', self.dry_run)
        return assets
        
    def create_snapshot(self, assets: Dict):
        if self.dry_run:
            safe_log(f"模擬建立快照於 {self.backup_dir}", 'info', self.dry_run)
            return
        if not os.path.exists(self.backup_dir): os.makedirs(self.backup_dir)
        with open(f"{self.backup_dir}/asset_list.json", 'w', encoding='utf-8') as f:
            json.dump(assets, f, ensure_ascii=False, indent=2)
        
        git_hash = self._get_git_hash()
        metadata = {'version': self.version, 'level': self.level, 'timestamp': self.timestamp, 'git_hash': git_hash}
        with open(f"{self.backup_dir}/metadata.json", 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        # 關鍵自動化：同步至 MEMORY.md
        if self.syncer.update_version_history(self.version, self.level, self.timestamp, assets, git_hash):
            safe_log("MEMORY.md 版本歷史已自動同步", 'ok')
            
    def _get_git_hash(self) -> str:
        try:
            import subprocess
            result = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True)
            return result.stdout.strip() or "no-git"
        except: return "unknown"

    def create_backup(self):
        if self.level != 'major' or self.dry_run: return
        full_dir = f"backups/full/{self.version}"
        if not os.path.exists("backups/full"): os.makedirs("backups/full")
        shutil.copytree('.', full_dir, ignore=shutil.ignore_patterns('backups', '.git', 'node_modules', '__pycache__'))
        safe_log(f"完整備份完成: {full_dir}", 'ok')

def main():
    parser = argparse.ArgumentParser(description="ProCore 自動化版本與記憶同步工具")
    parser.add_argument('--version', required=True)
    parser.add_argument('--level', required=True, choices=['major', 'minor', 'patch'])
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    
    manager = VersionManager(args.version, args.level, args.dry_run)
    if not manager.confirm_major_version(): sys.exit(1)
    
    assets = manager.scan_assets()
    manager.create_snapshot(assets)
    manager.create_backup()
    safe_log("作業完成！您的記憶與資產均已安全。職人精神，始於細節。", 'ok', args.dry_run)

if __name__ == "__main__": main()
