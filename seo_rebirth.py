import os

# 定義精準的分類與推薦邏輯
EURO_LINKS = [
    {"title": "BMW FEM/BDC 底層解碼工藝", "link": "/article-bmw-fem-advanced-tech"},
    {"title": "賓士 FBS3 智慧鑰匙全丟救援", "link": "/article-benz-fbs3-xindian-rescue"},
    {"title": "VW Pointer 引擎電腦解碼實錄", "link": "/article-vw-pointer-xianxi-rescue"}
]

ASIA_LINKS = [
    {"title": "Lexus 智慧鑰匙遺失現場配製", "link": "/article-lexus-taichung-service"},
    {"title": "Honda Fit 智能鑰匙全丟救援", "link": "/article-honda-fit-tanaka-rescue"},
    {"title": "2026 年鑰匙全丟救援成本分析", "link": "/article-lost-key-comparison"}
]

TECH_LINKS = [
    {"title": "解碼設備完整分析：百萬設備的重要性", "link": "/article-decoding-equipment"},
    {"title": "Keyless 系統常見故障診斷指南", "link": "/article-keyless-troubleshooting"},
    {"title": "美系車零關稅時代的技術挑戰", "link": "/article-us-car-market-tech"}
]

def inject_internal_links():
    files = [f for f in os.listdir('.') if f.startswith('article-') and f.endswith('.html')]
    
    for filename in files:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # 避免重複注入
        if 'id="related-articles"' in content:
            continue
            
        # 決定推薦清單
        if any(brand in filename for brand in ['bmw', 'benz', 'vw', 'skoda']):
            recs = EURO_LINKS[:2] + TECH_LINKS[:1]
        elif any(brand in filename for brand in ['lexus', 'honda', 'toyota']):
            recs = ASIA_LINKS[:2] + TECH_LINKS[:1]
        else:
            recs = TECH_LINKS[:2] + EURO_LINKS[:1]
            
        # 建立 HTML
        links_html = '\n        <!-- SEO 內鏈網區塊 -->\n        <section id="related-articles" class="mt-20 border-t border-white/10 pt-12">\n            <h3 class="text-gold-accent font-bold text-xl mb-8 font-cinzel tracking-widest uppercase text-center">Related Insights / 推薦閱讀</h3>\n            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">'
        
        for rec in recs:
            if rec['link'] in filename: continue # 跳過自己
            links_html += f'\n                <a href="{rec["link"]}" class="glass-panel p-6 block hover:border-gold-accent/50 transition duration-300">\n                    <p class="text-[10px] text-gray-500 mb-2 tracking-widest uppercase text-center">EXPERT VIEW</p>\n                    <h4 class="text-white font-bold text-sm leading-relaxed text-center">{rec["title"]}</h4>\n                    <p class="text-gold-accent text-[10px] mt-4 uppercase tracking-[0.2em] text-center">Read More →</p>\n                </a>'
            
        links_html += '\n            </div>\n        </section>\n    </article>'
        
        # 進行注入
        if '</article>' in content:
            new_content = content.replace('</article>', links_html)
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"✅ Injected links into: {filename}")

if __name__ == "__main__":
    inject_internal_links()
