# CarKey production baseline observation

This is a point-in-time observation. It is not a permanent golden value. If production changes after capture, later checks must report drift without rewriting this record, changing production, or changing expectations to force a pass.

- Captured at (Asia/Taipei): `2026-07-16T00:58:11+08:00`
- Live remote `main` SHA: `15301685c7d8dcb709c253b0759c770361840a54`
- Production origin: `https://www.carkey.com.tw`
- Comparison source: `JuiHsuan-otto/procore-auto-key` at the SHA above
- Result: `7 match / 0 drift`
- Command: `npm run seo:baseline -- --remote-sha 15301685c7d8dcb709c253b0759c770361840a54 --require-match`

## Observations

| URL | File | HTTP | Content-Type | Content-Length | ETag | Last-Modified | Cache-Control | Server | X-Vercel-Cache | X-Vercel-ID | Production body SHA-256 | Remote file SHA-256 | Result |
|---|---|---:|---|---:|---|---|---|---|---|---|---|---|---|
| `/` | `index.html` | 200 | `text/html; charset=utf-8` | not sent | `W/"7cb29ecd687800e67e61ce0da5e2d0d8"` | `Mon, 13 Jul 2026 00:46:01 GMT` | `public, max-age=0, must-revalidate` | `Vercel` | `HIT` | `hkg1::cfmx8-1784134691748-9fa705f9faba` | `e919ca3574e28dbc7cf4a173c392d52ca7353f5be1e5ad8ee222425b15744f81` | `e919ca3574e28dbc7cf4a173c392d52ca7353f5be1e5ad8ee222425b15744f81` | match |
| `/robots.txt` | `robots.txt` | 200 | `text/plain; charset=utf-8` | `255` | `"e9691db856777cb142289fba85913a2a"` | `Wed, 15 Jul 2026 16:16:21 GMT` | `public, max-age=0, must-revalidate` | `Vercel` | `HIT` | `hkg1::zk6lg-1784134692211-6ebcfb8f0bc1` | `bc142a6d95fed6f1aeded7e48624a0e37975ae760d3d8a6070d75a04fbcd3e45` | `bc142a6d95fed6f1aeded7e48624a0e37975ae760d3d8a6070d75a04fbcd3e45` | match |
| `/sitemap.xml` | `sitemap.xml` | 200 | `application/xml` | not sent | `W/"111fe7a1153ff9c94534fb35284b473c"` | `Wed, 15 Jul 2026 16:16:21 GMT` | `public, max-age=0, must-revalidate` | `Vercel` | `HIT` | `hkg1::7fbhc-1784134692562-9ee254c025f7` | `4c24e3c7275fa6e82b1c72aba0094342792d47d5c2c75e3539e95e530d0f2dbe` | `4c24e3c7275fa6e82b1c72aba0094342792d47d5c2c75e3539e95e530d0f2dbe` | match |
| `/car-key-lost-service` | `car-key-lost-service.html` | 200 | `text/html; charset=utf-8` | not sent | `W/"e6e4da663a13d22b86f9b7acc38ac1f0"` | `Wed, 15 Jul 2026 16:58:13 GMT` | `public, max-age=0, must-revalidate` | `Vercel` | `MISS` | `hkg1::4vb96-1784134693055-8a62c04afa19` | `ac90b250414c690f88e7fd453ffc03ad3402f53b61854025be2baf417c0b1769` | `ac90b250414c690f88e7fd453ffc03ad3402f53b61854025be2baf417c0b1769` | match |
| `/article-bmw-smart-key-owner-guide` | `article-bmw-smart-key-owner-guide.html` | 200 | `text/html; charset=utf-8` | not sent | `W/"84b86e53aa6ddf9f3e58149ede58fe6a"` | `Wed, 15 Jul 2026 03:05:36 GMT` | `public, max-age=0, must-revalidate` | `Vercel` | `HIT` | `hkg1::4vb96-1784134693463-bb1e7ee5e77a` | `75547bb4c16653faa53b01cb9449a1ef2569efa2ebeb8bd719e4bee636012192` | `75547bb4c16653faa53b01cb9449a1ef2569efa2ebeb8bd719e4bee636012192` | match |
| `/article-audi-r8-neihu-all-keys-lost` | `article-audi-r8-neihu-all-keys-lost.html` | 200 | `text/html; charset=utf-8` | not sent | `W/"f566345faf5e75320a73ea2c27a566c0"` | `Wed, 15 Jul 2026 16:21:33 GMT` | `public, max-age=0, must-revalidate` | `Vercel` | `HIT` | `hkg1::cfmx8-1784134693877-580ec718070c` | `0a0d4fb062ad17ca94fd665361d22280a26be097670fd48b337e5dbe7f63e008` | `0a0d4fb062ad17ca94fd665361d22280a26be097670fd48b337e5dbe7f63e008` | match |
| `/assets/js/procore-conversion-tracking.js` | `assets/js/procore-conversion-tracking.js` | 200 | `application/javascript; charset=utf-8` | not sent | `W/"814dc9cc755fbc0b5896292d0baeb2c9"` | `Mon, 13 Jul 2026 00:08:21 GMT` | `public, max-age=0, must-revalidate` | `Vercel` | `HIT` | `hkg1::4vb96-1784134694198-4c7679da3786` | `bcd6d0758672bb924230418effec6b18424516adf826cd2a537fb5e1be559264` | `bcd6d0758672bb924230418effec6b18424516adf826cd2a537fb5e1be559264` | match |

The response-header summary intentionally records absent `Content-Length` as “not sent.” The baseline tool also records each final response URL and comparison URL in its JSON output.
