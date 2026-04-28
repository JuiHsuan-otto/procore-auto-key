# ProCore AI 跨平台內容自動化 SOP

版本：v1.0
日期：2026-04-28
品牌：極致核心 ProCore
官網：https://www.carkey.com.tw
LINE ID：@420gknem
電話：0909277670

## 0. 核心原則

這份 SOP 是給 AI 助理、排程器與未來接手者使用。目標不是讓每個平台都貼一樣的文章，而是讓官網先穩定累積 SEO 權重，再用 Blogger、Threads、Google 商家檔案做分發、信任補強與回流。

必守規則：

- 官網是唯一 canonical source，所有 SEO 主內容以官網為準。
- Blogger、Threads、Google Business Profile 只做延伸摘要、導流與品牌提醒，不取代官網文章。
- 未經使用者明確批准，不得自動公開發布到 Blogger、Threads、Google Business Profile。
- 草稿產生、SEO 檢查、連結驗證、排程建議可以自動執行。
- 新增官網 HTML 文章後，必須使用既有 `publish_tool.py` 同步 `blog.json`、`blog.html`、`sitemap.xml`，不得手動硬改清單與 sitemap。
- 所有公開連結使用乾淨網址，例如 `/article-lost-key-rescue-guide`，不要在公開文案放 `.html`。
- 聯絡資料固定為 `LINE ID：@420gknem`、`電話：0909277670`。
- 不要承諾「保證」、「最便宜」、「全台第一」這類無法驗證的句子。
- 不揭露敏感技術細節、繞過方法、憑證、token、客戶個資。

## 1. 平台定位

| 平台 | 主要角色 | 內容用途 | 預設狀態 |
|---|---|---|---|
| 官網 | SEO 主站與品牌信任核心 | 完整文章、案例、服務頁、FAQ、結構化資料 | 驗證後可發布 |
| Blogger | 外部文章與回鏈 | 用不同切角摘要官網內容，補一個自然回鏈 | 草稿 |
| Threads | 短內容觸及 | 提醒、經驗分享、常見問題、品牌存在感 | 草稿 |
| Google Business Profile | 在地搜尋曝光 | 商家動態、服務提醒、案例摘要、CTA | 草稿 |

## 2. 內容狀態流程

每一則內容都要有狀態，不要直接從想法跳到發布。

1. `idea`：主題或案例候選。
2. `drafted`：已產出官網或跨平台草稿。
3. `validated`：已通過 SEO、連結、電話、LINE、禁用語檢查。
4. `approved_for_publish`：使用者明確批准可發布的平台。
5. `published`：已對外發布。
6. `verified`：已確認網址、版面、CTA、索引資料正常。
7. `logged`：已記錄發布網址、日期與後續追蹤事項。

自動化可以做到 `validated`；公開發布必須等使用者批准。

## 3. 官網發文邏輯

官網文章分三種：

- 案例文：有真實車款、地點、問題、處理結果才寫。
- 指南文：用來承接搜尋問題，例如「汽車鑰匙全丟怎麼辦」。
- 地區服務文：補足「地區 + 品牌 + 問題」搜尋需求。

官網 SEO 結構：

- `title`：地區 + 品牌/車款 + 問題 + 處理方式 | 極致核心 ProCore。
- `h1`：自然語氣，不要硬塞關鍵字。
- `meta description`：70-110 個中文字，說清楚服務、地區、情境與 CTA。
- 第一段：自然放一次主關鍵字，讓讀者一進來就知道這篇能解決什麼。
- `h2`：症狀、處理流程、時間/費用因素、安全提醒、相關案例。
- 圖片 `alt`：描述車款與情境，不做關鍵字堆疊。
- 內部連結：2-4 個，連到相關文章、`/blog`、`/cases`、`/service-areas`。
- CTA：文末固定電話與 LINE。
- JSON-LD：文章用 `Article`，服務頁/首頁保留 `LocalBusiness`，常見問答可加 `FAQPage`。
- sitemap：新文章必須透過同步工具更新。

新增 HTML 文章標準命令：

```bash
python ..\publish_tool.py "文章標題" "/article-filename.html" "分類" "文章摘要"
```

注意：這是既有發文 SOP 的規則；跨平台工具只負責產生草稿包，不取代官網同步流程。

## 4. SEO 關鍵字置入邏輯

主關鍵字公式：

```text
地區 + 品牌/車款 + 問題
```

例：

- 台中 BMW 鑰匙全丟
- 彰化 Mercedes-Benz 智慧鑰匙備份
- 南投 Toyota 晶片鑰匙遺失
- 汽車鑰匙全丟免拖車

次關鍵字公式：

```text
問題 + 處理方式
品牌 + 系統/車款 + 安全結果
```

例：

- 智慧鑰匙沒反應怎麼辦
- 感應鑰匙現場配製
- BMW FEM/BDC 鑰匙匹配
- Benz FBS3 鑰匙全丟

置入位置：

- 標題一次。
- H1 或第一段一次。
- H2 挑 1-2 個自然放入。
- Meta description 一次即可。
- 圖片 alt 用描述句，不硬塞。
- 內部連結錨點要像真人會點的文字，例如「汽車鑰匙全丟處理流程」。

禁止做法：

- 同一段重複塞同一組字。
- 為了 SEO 寫不像人講話的句子。
- 用沒有根據的成功率、價格、時效承諾。
- 為了吸流量寫與服務無關的熱門詞。

## 5. 文案語氣規範

公開內容要像店家與技師在跟車主說明，不要像 AI 報告。

建議語氣：

- 先安撫，再說步驟。
- 先講車主能做的安全檢查，再說何時需要技師。
- 句子短一點，避免大詞。
- 用「可以先傳車款、年份、所在地」這種實用指引。
- 案例文寫「這次狀況是...」，指南文寫「如果你遇到...」。

避免詞：

- 職人
- 火速
- 攻克
- 深入解析
- 完美匹配
- 守護您的駕駛權限
- 魂動美學
- 數據重構
- 全台．跨區．遠征
- 本文將帶您了解
- 一站式解決方案

## 6. Blogger 發文邏輯

Blogger 不複製整篇官網文章，避免內容互搶權重。

格式：

- 500-900 中文字為主。
- 第一段改寫情境，不直接貼官網第一段。
- 前 1/3 放一個官網乾淨網址回鏈，可加 UTM。
- 中段放準備資料、注意事項、常見情境。
- 文末放電話與 LINE。
- 標籤放品牌、地區、問題、`汽車鑰匙`、`智慧鑰匙`、`極致核心`。

發布方式：

- 優先用 Blogger API v3 `posts.insert`，先以草稿建立。
- 若使用 email-to-Blogger，只能從環境變數讀取 SMTP 帳密。
- 不得把 app password、OAuth token、client secret 寫入程式或提交到 Git。

## 7. Threads 發文邏輯

Threads 用來做短提醒與品牌存在感，不要塞滿廣告語。

格式：

- 每則 500 字以內。
- 一次只講一個觀念。
- 最多 1 個主題標籤，可不用。
- 可以 1-3 則串成一組。
- 連結只放一個，或完全不放，視內容自然度決定。

常用切角：

- 鑰匙全丟時先不要急著拖車。
- 智慧鑰匙沒反應，不一定是鑰匙壞掉。
- 停在地下室、拍場、維修廠時，聯絡前要準備哪些資料。
- 備用鑰匙不是多花錢，是避免下次全丟成本更高。

## 8. Google Business Profile 發文邏輯

Google 商家發文要像在地服務通知，重點是讓附近搜尋的人看懂可不可以找你。

預設 payload：

```json
{
  "languageCode": "zh-TW",
  "topicType": "STANDARD",
  "summary": "在地服務摘要",
  "callToAction": {
    "actionType": "LEARN_MORE",
    "url": "https://www.carkey.com.tw/article-slug?utm_source=google_business_profile&utm_medium=local_post&utm_campaign=ai_content_pack"
  }
}
```

規範：

- 120-350 中文字最自然，系統上限可更長但不建議寫滿。
- 必須提到地區或服務情境。
- CTA 用 `LEARN_MORE` 回官網。
- 有合適照片再放，沒有照片不要硬塞錯圖。
- 不發產品型貼文，本 SOP 只處理一般商家動態。

## 9. 跨平台草稿包

一篇官網文章可以轉成一包跨平台草稿：

```text
drafts/YYYY-MM-DD-article-slug/
├─ manifest.json
├─ blogger.html
├─ threads.txt
├─ google-business-profile.json
└─ website-checklist.md
```

產生草稿包：

```bash
python scripts/content_automation/generate_content_pack.py --source latest
```

指定文章：

```bash
python scripts/content_automation/generate_content_pack.py --link /article-lost-key-rescue-guide
```

驗證草稿包：

```bash
python scripts/content_automation/validate_content_pack.py drafts/YYYY-MM-DD-article-slug
```

`drafts/` 是本機工作資料夾，已加入 `.gitignore`。除非使用者要求保存草稿，否則不要提交。

## 10. 自動化排程建議

預設週期：

| 星期 | 台北時間 | 任務 |
|---|---:|---|
| 週一 | 09:30 | 檢查搜尋意圖與本週主題 |
| 週二 | 10:00 | 撰寫或更新官網文章草稿 |
| 週三 | 10:00 | 產生 Blogger 延伸草稿 |
| 週四 | 12:30 | 產生 Google 商家貼文草稿 |
| 週五 | 18:30 | 產生 Threads 草稿 |
| 週日 | 20:30 | 驗證草稿、整理發布紀錄、規劃下週 |

建議給 AI 排程器的任務提示：

```text
在 D:\procore-repo 依 AI_CONTENT_AUTOMATION_SOP.md 檢查 ProCore 內容佇列與 blog.json 最新項目。只產生或驗證官網、Blogger、Threads、Google Business Profile 草稿，不得公開發文。若需要發布，列出待批准平台、草稿路徑、官方網址與建議發布時間。執行 validate_content_pack.py 驗證後回報結果。
```

排程邊界：

- 可以自動產草稿。
- 可以自動檢查 SEO 與連結。
- 可以自動提醒哪些草稿可發布。
- 不可以自動登入平台公開發文。
- 不可以在未批准時推送新官網文章。

## 11. 憑證與環境變數

所有憑證放在本機環境變數或未追蹤的 `.env.local`，不得提交。

Blogger email fallback 需要：

```text
BLOGGER_SMTP_USER=
BLOGGER_SMTP_APP_PASSWORD=
BLOGGER_EMAIL_TARGET=
```

未來 API 發布可預留：

```text
BLOGGER_BLOG_ID=
THREADS_USER_ID=
THREADS_ACCESS_TOKEN=
GBP_ACCOUNT_ID=
GBP_LOCATION_ID=
```

注意：目前自動化工具只產生草稿與 payload，不直接發布。

## 12. 發布前檢查清單

發布前必須確認：

- 官網網址存在或已規劃乾淨網址。
- 公開文案沒有 `.html` 連結。
- 電話是 `0909277670`。
- LINE 是 `@420gknem`。
- Blogger 有官網回鏈。
- Threads 每則 500 字內。
- Google Business Profile JSON 格式正確。
- 沒有禁用語與 AI 腔。
- 沒有憑證、token、客戶個資。
- `git diff --check` 通過。
- 新官網文章已同步 sitemap。

## 13. 官方文件參考

- Blogger API v3 Posts insert：https://developers.google.com/blogger/docs/3.0/reference/posts/insert
- Blogger API overview：https://developers.google.com/blogger
- Google Business Profile create posts：https://developers.google.com/my-business/content/posts-data
- Google Business Profile localPosts resource：https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts
- Meta Threads API docs：https://developers.facebook.com/docs/threads/
- Meta Threads API Postman collection：https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api
