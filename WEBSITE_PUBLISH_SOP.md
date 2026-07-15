# 官網文章發布規格（Website Publish SOP）

版本：v2.0
日期：2026-07-15

## 1. 適用範圍

適用於案例文、指南文與地區服務文。完整語氣、SEO、隱私及跨平台規範見 `AI_CONTENT_AUTOMATION_SOP.md`。

## 2. 新文章必要內容

- `article-[slug].html`，UTF-8、單一 H1、唯一 title、meta description、canonical、OG/Twitter metadata。
- Article（或適合頁型）JSON-LD；若加入 FAQ，畫面內容與 FAQ schema 必須一致。
- 2–4 個自然內部連結、可理解的圖片 alt、電話 `0909277670`、LINE `@420gknem`。
- 公開內容只保留行政區、車款、外顯問題與結果；不得放車牌、VIN、完整地址、姓名、證件或可被複製的技術流程。
- 使用者提供的照片預設可用；只在發現 GPS metadata 時移除 metadata，不改畫面，除非使用者另有要求。

## 3. 強制同步

不要手動維護多份索引。建立 HTML 後執行：

```bash
python publish_tool.py "文章標題" "/article-slug.html" "分類" "摘要"
```

案例文依需要加上 `--case-region`、`--case-car`、`--case-img`、`--case-type`。工具負責同步 `blog.json`、`blog.html`、`cases.html`、`cases.json` 與 `sitemap.xml`。

## 4. 發布前驗證

```bash
python scripts/site_audit.py
git diff --check
```

另確認圖片存在、JSON 可解析、乾淨網址可由 `vercel.json` 規則提供、沒有亂碼或連續問號、CTA 聯絡值正確。若頁面含 JavaScript，額外對抽出的 script 執行 `node --check`。

## 5. Git 與部署

只提交本次相關檔案，使用一般 commit 與 push。禁止 `--force`，禁止把草稿、token、OAuth 檔或客戶資料提交。部署後抽查實際網址；不可達時如實回報。

## 6. 外部平台

Blogger、Threads、Google Business Profile 預設僅草稿。不得加入未經同意的聯盟行銷連結，也不得在 metadata 藏入畫面未揭露的競品／場域品牌關鍵字。GBP API 發布目前停用。
