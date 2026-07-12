# ProCore 網站內容發布規格

版本：v2.0
日期：2026-07-12

## 內容與 SEO

- 官網 `https://www.carkey.com.tw` 是唯一 canonical。
- 每頁需有唯一 title、description、單一 H1、canonical、OG/Twitter 圖片與 BreadcrumbList；文章再加入適當的 Article/FAQ。
- 公開網址使用無 `.html` 的乾淨路徑。舊網址用永久重新導向，不做隱藏關鍵字或搜尋引擎專用內容。
- 文案以車主能理解的資訊為主，不做無法驗證的保證，不公開同業可利用的技術流程。
- 案例去識別化：不放車牌、VIN、完整地址、姓名、憑證或內部操作資料。

## 同步規則

新增文章後必須執行 `publish_tool.py`；不得手動修改文章清單或 sitemap。工具應同步：

- `blog.json`
- `blog.html`
- `cases.json`
- `cases.html`
- `sitemap.xml`

非文章功能頁使用 `--page-only`，避免污染 blog/cases。

## 跨平台

- Blogger、Threads、Google Business Profile 都是草稿與回鏈層，不得取代官網原文。
- 未經使用者明確點名，不得公開發到外部平台。
- Google Business Profile API 路徑目前停用；不要嘗試自動授權或發文。
- 不加入未經要求的聯盟連結、追蹤碼或第三方關鍵字。

## 驗證與部署

```bash
npm run validate:site
python -m py_compile publish_tool.py
git diff --check
git fetch origin main
git push origin main
```

禁止 force push。若遠端已更新，先整合並重新驗證。上線後檢查 HTML 狀態碼、canonical、主要 CTA、電話 `0909277670`、LINE `@420gknem`、文章索引與 sitemap。
