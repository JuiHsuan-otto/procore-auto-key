# CarKey 官網部署 SOP

版本：v2.0
日期：2026-07-15

本文件只處理 `carkey.com.tw` 靜態官網。內容規範與跨平台邊界以 `AI_CONTENT_AUTOMATION_SOP.md` 為準；兩者衝突時，以該文件與根目錄 `AGENTS.md` 為準。

## 原則

- 官網是唯一 canonical source；公開網址使用無 `.html` 的乾淨路徑。
- 不使用 force push，不直接改寫遠端歷史，不把憑證寫進 Git。
- 新增文章必須用 `publish_tool.py` 同步清單與 sitemap；不得手動修改 `blog.html`、`cases.html` 或 `sitemap.xml` 來取代同步工具。
- 修改舊文不等於新增文章；若標題、摘要、分類、案例圖片或網址沒有變，只需更新 sitemap 的 `lastmod`（可透過同步工具重跑同一文章）。
- 外部平台預設只產草稿；GBP API 路徑目前停用。

## 發布步驟

1. 確認工作樹與分支：`git status --short`、`git branch --show-current`。
2. 新文章先完成 HTML、圖片與去識別化檢查，再執行：
   ```bash
   python publish_tool.py "文章標題" "/article-slug.html" "分類" "摘要" [案例參數]
   ```
3. 執行發布閘門：
   ```bash
   python scripts/site_audit.py
   python -m json.tool vercel.json >/dev/null
   git diff --check
   ```
4. 人工抽查：手機版 CTA、電話、LINE、圖片、canonical、OG 預覽、表單（若有）及主要內部連結。
5. 提交並正常推送目前分支：
   ```bash
   git add <本次相關檔案>
   git commit -m "fix: ..."   # 新文章可用 feat: publish ...
   git push -u origin <目前分支>
   ```
6. 等部署完成後，以實際網址確認首頁、文章、sitemap、別名導向與聯絡 CTA。若線上環境不可達，保留本地驗證結果並明確回報，不能假稱已上線。

## 回復方式

- 發布失敗時不要 force push；先保留 commit，檢查網路、權限、預設分支與 Vercel 專案連結。
- 回退使用新的 revert commit：`git revert <commit>`，再正常 push。
- 舊備份可作參考，但不得把含憑證或個資的備份加入版控。
