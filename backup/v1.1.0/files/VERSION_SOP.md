# 🔄 版本切換標準作業流程

## 版本分級
### Major Version (x.0.0)
重大更新，涉及：
- 核心架構改變
- 設計風格重塑
- 重要功能新增

### Minor Version (0.x.0)
功能性更新，涉及：
- 新增重要文章
- 新增主要功能
- 新增關鍵資產

### Patch Version (0.0.x)
修復性更新，涉及：
- Bug 修復
- 內容微調
- 小幅優化

## Major 版本切換檢查流程
### Phase 1: 前置準備
1. 確認所有更改已提交
2. 執行 pre_version_change.py
3. 檢查自動生成的報告
4. 確認備份目錄完整性

### Phase 2: 文章檢查
5. 驗證所有文章路徑
6. 確認內部連結完整性
7. 檢查圖片引用正確性
8. 確認 SEO meta 資訊

### Phase 3: 資產確認
9. 檢查圖片資產完整性
10. 確認影片資源可用性
11. 驗證字體檔案載入
12. 檢查第三方資源狀態

### Phase 4: 功能測試
13. 驗證所有按鈕功能
14. 確認表單提交正常
15. 測試 RWD 響應性
16. 檢查載入性能

### Phase 5: 發布程序
17. 更新 MEMORY.md
18. 建立版本標記
19. 推送至正式環境
20. 監控系統狀態

## 版本號命名規則
- 格式：vX.Y.Z
- X: Major version
- Y: Minor version
- Z: Patch version

## 備份目錄結構
```
backup/
├── v1.0.0/
│   ├── html/
│   ├── assets/
│   └── metadata.json
├── v1.1.0/
└── v1.2.0/
```

## 緊急回滾流程
1. 確認目標版本
2. 執行完整性檢查
```bash
python verify_backup.py v1.1.0
```
3. 執行回滾
```bash
python rollback.py v1.1.0 --force
```
4. 驗證系統狀態
5. 更新版本記錄