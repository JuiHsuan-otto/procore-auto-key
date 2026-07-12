import os

# 定義語法替換對應
TONE_MAPPING = {
    "原廠級設備": "頂尖解碼工藝",
    "原廠級高階設備": "專業級高階器材",
    "原廠認證設備": "與時俱進的專業診斷設備",
    "百萬級原廠設備": "資深職人專用解碼設備",
    "原廠級現場匹配": "專業現場匹配服務",
    "原廠等級": "職人級別",
    "原廠報價": "官方通路報價",
    "原廠認證": "專業技術認證"
}

def repair_tone():
    files = [f for f in os.listdir('.') if f.startswith('article-') and f.endswith('.html')]
    
    for filename in files:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = content
        for old, new in TONE_MAPPING.items():
            new_content = new_content.replace(old, new)
        
        if new_content != content:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"DONE: Optimized tone for {filename}")

if __name__ == "__main__":
    repair_tone()
