# 🚀 CarKey 自動化部署計畫 (carkey-deploy)

本文件定義了 Meico 處理「極致核心 ProCore」網站內容時的**強制性作業流程**。

## 核心目標
**消滅所有隱形文章**。確保任何 `article-*.html` 產出後，必須在官網列表可見、且被搜尋引擎索引。

## 強制執行 Feedback Loop
當生成、修改或刪除任何文章檔案後，**必須**依序執行以下步驟：

1.  **Indexing (索引同步)**
    - 使用 `publish_tool.py` 或手動更新 `blog.json`。
    - 更新 `blog.html` 中的 `blogData` JavaScript 陣列。
    - *原則：新文章必須出現在網頁列表。*

2.  **SEO Sync (地圖同步)**
    - 呼叫 `rebuild_sitemap.py` 重新生成完整的 `sitemap.xml`。
    - 確認 `lastmod` 更新為當天日期。

3.  **Verification (資料驗證)**
    - 執行 `Get-Content blog.json | ConvertFrom-Json` 確保 JSON 格式無誤。
    - 檢查 `sitemap.xml` 是否包含最新的網址。

4.  **Final Action (部署回報)**
    - 執行 `git add .`, `git commit`, `git push`。
    - **主動回報**：告知老闆 Vercel 部署後的驗證結果（例如使用 `web_fetch` 確認頁面已上線）。

## 定期維護 (Heartbeat)
- 每次 Session 啟動時，主動檢查是否有未同步的 HTML 檔案。
- 定期執行 Sitemap 全量重構，確保索引完整性。

---
**Meico 指令：此流程優先級高於一切內容創作，未完成同步不得結束任務。**
