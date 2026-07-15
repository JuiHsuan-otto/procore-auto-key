# ProCore 官網發布 SOP

版本：v2.0
日期：2026-02-27
適用網站：https://www.carkey.com.tw

> 本文件是官網檔案與部署的執行規格。跨平台內容、授權邊界與排程請先讀 `AI_CONTENT_AUTOMATION_SOP.md`；若兩者衝突，以該文件與 `AGENTS.md` 的較嚴格規則為準。

## 1. 不可違反的原則

- 官網是唯一 canonical source。
- 使用者提供的照片預設可公開，不擅自裁切、遮罩或改圖；只在發現 GPS metadata 時移除 metadata。若使用者另有去識別化要求，依指示處理。
- 案例只保留「行政區、場景、車款、外顯問題、處理結果」；不公開車牌、VIN、姓名、精確地址、憑證、設備型號、讀寫/繞過流程或同業可複製的技術細節。
- 不使用隱藏文字、關鍵字欺騙、品牌暗植或其他搜尋引擎規避手法。
- 不強制插入聯盟連結；任何付費、推薦或聯盟內容都必須先取得使用者明確同意並標示。
- 不承諾無法驗證的價格、時效、成功率或「第一／最便宜／保證」。
- 聯絡資料固定：電話 `0909277670`、LINE ID `@420gknem`。

## 2. 新文章檔案規格

每篇文章至少包含：

1. `lang="zh-TW"`、UTF-8、mobile viewport。
2. 唯一且自然的 `<title>`、meta description。
3. 乾淨 canonical：`https://www.carkey.com.tw/article-slug`，公開連結不帶 `.html`。
4. OG/Twitter title、description、image、URL。
5. 單一清楚的 H1、合理 H2/H3 層級、2–4 個相關站內連結。
6. Article JSON-LD；若頁面真的有可見 FAQ，才加入 FAQPage。
7. 圖片有描述性 alt、固定尺寸或長寬資訊，避免版面位移。
8. 文末 CTA：電話與 LINE；語氣像店家直接說明，不像 AI 報告。

## 3. 唯一清單同步方式

建立或重建文章 HTML 後，必須執行 `publish_tool.py`，不得手改 `blog.html`、`cases.html`、`cases.json`、首頁 `latestCases` 或 `sitemap.xml` 來取代同步。

一般文章：

```bash
python publish_tool.py \
  "文章標題" "/article-slug.html" "技術專欄" "文章摘要" \
  --date YYYY.MM.DD --lastmod YYYY-MM-DD \
  --keywords "關鍵字一,關鍵字二"
```

案例文章：

```bash
python publish_tool.py \
  "文章標題" "/article-slug.html" "案例分享" "文章摘要" \
  --date YYYY.MM.DD --lastmod YYYY-MM-DD \
  --keywords "地區 車款 問題,次關鍵字" \
  --case-region "縣市行政區" \
  --case-car "品牌車型" \
  --case-img "img/資料夾/圖片.jpg" \
  --case-type "鑰匙全丟" \
  --case-label "首頁短標籤"
```

同步工具應完成：

- `blog.json` 與 `blog.html` 的 `blogData`
- 案例的 `cases.html`、`cases.json`
- 案例的首頁 `latestCases`（保留最新四筆）
- `sitemap.xml`
- 發布前檢查文章檔、canonical、案例圖與明顯亂碼

## 4. 發布前驗證

```bash
python scripts/verify_site.py
git diff --check
git status --short
```

人工再確認：

- 首頁、文章、`/blog`、`/cases`、`/service-areas`、`/vcard`、`/rescue-request` 可開啟。
- 首頁最新案例卡片是可鍵盤操作的真實連結，不只依賴 `onclick`。
- 電話是 `0909277670`，LINE 是 `@420gknem`。
- 無 `???`、Unicode replacement character、破損 JSON-LD、空連結或不存在的本地資產。
- 新 URL 已在 sitemap，乾淨網址與 `vercel.json` 規則一致。
- 手機寬度下 CTA、表單及導覽不溢出。

## 5. Git 與部署

先檢視差異，不使用 force push：

```bash
git diff --stat
git diff
git add .
git commit -m "feat: publish new article [文章標題]"
git push origin HEAD
```

禁止：

- `git push --force` 或未確認分支就推送到其他環境。
- 用部署成功取代內容驗證。
- 在網路或權限失敗時宣稱已上線。

推送後以正式站逐頁驗證；若環境無法連線，保留 commit，記錄錯誤並清楚告知尚未完成遠端驗證。

## 6. 官網以外平台

Blogger、Threads、Google Business Profile 一律依 `AI_CONTENT_AUTOMATION_SOP.md` 產生草稿；除非使用者明確點名某平台並同意公開，否則不得發佈。GBP API 路徑目前停用，不做登入、授權或 API 呼叫。
