import os

def enhance_old_articles():
    # 定義文章與照片的精準匹配關係
    mapping = {
        "article-bmw-gseries-keyless-rescue.html": {
            "img": "img/bmw_taichung_new.jpg",
            "alt": "BMW G-Series 現場解碼實錄",
            "caption": "現場實錄：BMW G-Series 專用行動工作站進行 BDC 數據重構"
        },
        "article-decoding-equipment.html": {
            "img": "img/ger_05.jpg",
            "alt": "高階汽車解碼儀器",
            "caption": "專業設備：使用進口頂規設備進行 EEPROM 資料無損讀取"
        },
        "article-keyless-troubleshooting.html": {
            "img": "img/jap_10.jpg",
            "alt": "Keyless 遙控器檢測",
            "caption": "技術細節：針對 Keyless 訊號發射強度進行精準量測"
        },
        "article-porsche-lost-key-rescue.html": {
            "img": "img/uk_04.JPG",
            "alt": "Porsche 鑰匙全丟救援",
            "caption": "實機操作：Porsche 高階防盜系統現場解密與同步"
        }
    }

    for html_file, data in mapping.items():
        if os.path.exists(html_file):
            with open(html_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 建立玻璃質感的圖片容器代碼
            img_html = f'''
            <div class="glass-panel my-10">
                <img src="{data['img']}" alt="{data['alt']}" class="rounded-lg mb-4 w-full shadow-2xl">
                <p class="text-center text-xs text-gray-500">{data['caption']}</p>
            </div>
            '''
            
            # 尋找內容段落起始處插入 (通常在第一個 </h2> 之前)
            if '</h2>' in content:
                parts = content.split('</h2>', 1)
                new_content = parts[0] + '</h2>' + img_html + parts[1]
                
                with open(html_file, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"✅ 已強化文章視覺: {html_file}")

if __name__ == "__main__":
    enhance_old_articles()
