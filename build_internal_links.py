import os
import re

def build_internal_links():
    # 定義文章分類
    articles = {
        "tech": [
            {"title": "BMW FEM/BDC 底層解碼工藝", "link": "article-bmw-fem-advanced-tech.html"},
            {"title": "為什麼專業拷貝需要高階設備？", "link": "article-decoding-equipment.html"},
            {"title": "Keyless 系統常見故障與維修指南", "link": "article-keyless-troubleshooting.html"}
        ],
        "euro": [
            {"title": "高雄福斯 VW T5 鑰匙全丟救援", "link": "article-vw-t5-kaohsiung-rescue.html"},
            {"title": "彰化線西 VW Pointer 引擎電腦解碼", "link": "article-vw-pointer-xianxi-rescue.html"},
            {"title": "Skoda Kodiaq 晶片鑰匙遺失處理", "link": "article-skoda-kodiaq-yunlin-rescue.html"}
        ],
        "asia": [
            {"title": "台中 Lexus 晶片鑰匙遺失配製", "link": "article-lexus-taichung-service.html"},
            {"title": "彰化田中 Honda Fit 智能鑰匙救援", "link": "article-honda-fit-tanaka-rescue.html"},
            {"title": "林口 Toyota RAV4 智慧鑰匙實錄", "link": "article-toyota-rav4-linkou-rescue.html"}
        ]
    }

    # 合併所有文章供全局推薦
    all_articles = articles["tech"] + articles["euro"] + articles["asia"]

    html_files = [f for f in os.listdir('.') if f.endswith('.html') and f.startswith('article-')]

    for file_path in html_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 避免重複注入
        if "id=\"related-articles\"" in content:
            continue

        # 選擇推薦邏輯：
        # 如果是歐系車文章，推薦其他歐系 + 技術指南
        # 如果是技術指南，推薦各系列最新案例
        recommendations = []
        if any(keyword in file_path for keyword in ['vw', 'bmw', 'skoda', 'porsche']):
            recommendations = articles["euro"][:2] + articles["tech"][:1]
        elif any(keyword in file_path for keyword in ['lexus', 'honda', 'toyota']):
            recommendations = articles["asia"][:2] + articles["tech"][:1]
        else:
            recommendations = all_articles[:3]

        # 建立 HTML 區塊 (玻璃質感面板)
        links_html = '<section id="related-articles" class="mt-20 border-t border-white/10 pt-12">'
        links_html += '<h3 class="text-gold-accent font-bold text-xl mb-8 font-cinzel tracking-widest uppercase">Related Insights / 推薦閱讀</h3>'
        links_html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-6">'
        
        for rec in recommendations:
            if rec['link'] in file_path: continue # 不推薦自己
            links_html += f'''
            <a href="{rec['link']}" class="glass-panel p-6 block hover:border-gold-accent/50 transition duration-300">
                <p class="text-xs text-gray-500 mb-2 tracking-widest uppercase">Expert View</p>
                <h4 class="text-white font-bold text-sm leading-relaxed">{rec['title']}</h4>
                <p class="text-gold-accent text-[10px] mt-4 uppercase tracking-[0.2em]">Read More →</p>
            </a>
            '''
        links_html += '</div></section>'

        # 在 </article> 結束標籤前注入
        if '</article>' in content:
            new_content = content.replace('</article>', links_html + '\n</article>')
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"🔗 已串連內鏈網: {file_path}")

if __name__ == "__main__":
    build_internal_links()
