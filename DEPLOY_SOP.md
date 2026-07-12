# ProCore 官網部署 SOP

版本：v2.0
日期：2026-07-12

## 原則

- GitHub `main` 是正式來源；先抓取遠端並確認共同歷史，禁止未知狀態下覆寫。
- 官網是唯一 canonical source。Blogger、Threads、Google Business Profile 預設只產生草稿；未被明確點名不得公開。
- 禁止 `--force`。遠端有新提交時，先整合、驗證，再一般 push。
- 不提交 token、cookie、客戶個資、記憶檔、草稿或本機設定。

## 發布新文章

1. 建立 `article-*.html`，使用 UTF-8、乾淨 canonical、自然中文、OG/Twitter、Breadcrumb 與合適的 Article/FAQ 結構化資料。
2. 圖片依使用者授權處理；預設不改畫面。若有 GPS metadata，只移除 metadata。
3. 只用 `publish_tool.py` 同步 `blog.json`、`blog.html`、`cases.html`、`cases.json`、`sitemap.xml`：
   ```bash
   python publish_tool.py "標題" "/article-slug.html" "分類" "摘要" --lastmod YYYY-MM-DD
   ```
4. 執行：
   ```bash
   npm run validate:site
   python -m py_compile publish_tool.py
   git diff --check
   git status --short
   ```
5. 先 `git fetch origin main`，確認本地沒有落後或分歧，再提交並 `git push origin main`。
6. 驗證正式站的首頁、文章、列表、聯絡按鈕、sitemap 與乾淨網址。網路受阻時要如實回報，不可宣稱已驗證。

## 一般頁面與工具頁

- 非文章頁可用 `publish_tool.py ... --page-only` 更新 sitemap，不可加入案例清單。
- 前端隱私工具不得把表單內容送到後端、分析服務或外部 API；不得使用 localStorage/sessionStorage。
- 聯絡資訊固定為電話 `0909277670`、LINE `@420gknem`。

## 回復

部署前使用 Git 分支或提交保存可回復點。發生問題時以 `git revert <commit>` 建立可稽核的回復提交；不要改寫正式分支歷史。
