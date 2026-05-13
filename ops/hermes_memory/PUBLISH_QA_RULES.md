# ProCore Publish QA Rules

Before a case can be approved or deployed, Hermes must check:

## Facts

- no `台灣` fallback if a specific location was given
- no `車輛`, `車款未確認`, or generic vehicle label
- year is a valid 4-digit vehicle year
- title, H1, summary, and keywords match the same vehicle and location

## Writing

- no repeated paragraphs
- no "案例分享" paragraph that repeats the same idea as "案件背景"
- no generic anxiety copy
- no exaggerated promises
- no unsupported "原廠標準"
- no universal "遙控、感應、啟動" unless the intake confirms those functions

- no Discord draft labels left in the article, such as `標題,`, `完整文章,`, `FAQ,`, or question lines ending with a comma
- no editor-only blocks such as `AI 口吻殘留自評`
- no awkward keyword-stuffed phrases such as `新北汽車鑰匙到場處理前`; write the same idea as a natural owner scenario instead
- no Discord split markers such as `(1/3)`, reaction UI text, or copied profile text
- no duplicate FAQ blocks: if the official template generates the final FAQ, remove or skip aiCopy sections headed `常見問題` / `FAQ`
- avoid internal QA language in customer-facing articles, including `安全邊界`, `可複製流程`, `設備名稱`, `操作方式`, `身分資料`, and rewrite as natural privacy/service wording
- use `智慧感應鑰匙` as the formal service term for confirmed smart/keyless/proximity-key cases; keep `智慧鑰匙`, `感應鑰匙`, `keyless`, `感應不到鑰匙`, `未偵測到鑰匙`, and `遙控器沒反應` as natural supporting search phrases when relevant
- do not force smart/keyless terminology into mechanical-key or motorcycle cases unless the intake confirms it
- long `aiCopy` JSON must be saved as a file and reported by path, not pasted as multi-part Discord messages

## SEO

- title includes location, year, vehicle, and service intent
- H1 reads naturally and contains locked facts
- meta description is 70-150 Chinese characters
- FAQ questions match the exact case type
- CTA asks for year, model, location, issue, and photos

## Privacy

- no plate, VIN, documents, full address, names, phone numbers
- no sensitive technical workflow
- images must be treated as redaction-required unless Otto explicitly confirms they are public-safe

## Deployment

- validate content pack first
- approve only after QA passes
- deploy only after Otto explicit publish approval
- Blogger is draft or explicit-only, never automatic by default
- Discord status must include `INTAKE`, `AI_COPY`, `CASE_PACK`, `VALID`, and `PUBLISH=not_requested` unless Otto explicitly approved publishing
