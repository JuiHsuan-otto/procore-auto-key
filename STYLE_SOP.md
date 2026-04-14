# 極致核心 ProCore - 官網文章樣式標準 (SOP v1.1)

處理任何實績發佈任務時，除了遵循 `PUBLISH_SOP.md` 之外，HTML 內容必須確保包含以下「黑金質感」標準組件，不得隨意更換樣式。

## 1. 文章底部「極致聯繫區塊」 (CTA Section)
這是 Otto 指定的高質感聯繫按鍵樣式，必須位於 `</main>` 前方。

### CSS 必要定義 (Style Section)
```css
:root {
    --gold: #D4AF37;
    --gold-dark: #AA8B20;
}
.cta-btn {
    background: linear-gradient(135deg, var(--gold), var(--gold-dark));
    color: #000;
    text-shadow: 0 1px 1px rgba(255,255,255,0.3);
    box-shadow: 0 4px 15px rgba(212, 175, 55, 0.2);
    transition: all 0.3s ease;
}
.cta-btn:hover {
    box-shadow: 0 6px 20px rgba(212, 175, 55, 0.4);
    transform: scale(1.02);
    filter: brightness(1.1);
}
```

### HTML 必要結構
```html
<footer class="mt-16 pt-12 border-t border-white/10 text-center">
    <p class="text-gray-300 text-sm mb-8 font-light leading-relaxed">如果您也遇到鑰匙全丟的緊急情況，<br>無論車輛停在哪裡，請立即聯繫極致核心專業團隊。</p>
    <div class="flex flex-col items-center gap-6">
        <a href="tel:0909277670" class="cta-btn px-16 py-4 rounded-sm font-bold tracking-[0.2em] text-sm flex items-center justify-center gap-3 w-full md:w-auto">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            24H 救援專線
        </a>
        <a href="https://line.me/R/ti/p/@420gknem" class="text-gray-400 hover:text-gold text-xs border-b border-transparent hover:border-gold/50 pb-1 transition flex items-center gap-2">
            加入官方 LINE (@420gknem) 預約
        </a>
    </div>
</footer>
```

## 2. 數據隱私過濾原則
*   **ECU/TCU 型號**：絕對不可寫出具體型號（如 MED17.5.21）。
*   **通訊協議**：改用「Security v2」或「高端安全協議」代稱。
*   **讀取模式**：移除「Boot」、「OBD」、「JCI」等具體字眼，改用「專業解碼模式」。
