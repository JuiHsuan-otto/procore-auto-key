import re

path = r"C:\Users\ottoy\.openclaw\workspace-carkey\workspace-carkey\procore-repo\index.html"

# 讀取檔案
with open(path, "rb") as f:
    raw_data = f.read()

# 強制以 utf-8 解碼並忽略錯誤
content = raw_data.decode("utf-8", "ignore")

# 1. 修正數據看板 (確保 0 被正確替換為數據)
content = re.sub(r'data-target="5221">0</div>', 'data-target="5221">5221+</div>', content)
content = re.sub(r'data-target="1514">0</div>', 'data-target="1514">1514+</div>', content)
content = re.sub(r'data-target="100">0</div>', 'data-target="100">100+</div>', content)
content = re.sub(r'data-target="24">0</div>', 'data-target="24">24+</div>', content)

# 2. 徹底重寫 latestCases 陣列
new_cases = """const latestCases = [
            { "car": "Porsche Cayenne", "label": "彰化和美智慧新增", "img": "img/porsche-cayenne-hemei/case-1.jpg", "link": "/article-porsche-cayenne-hemei.html" },
            { "car": "Honda HR-V", "label": "彰化市智慧救援", "img": "img/cases/honda-hrv-20260316.jpg", "link": "/article-honda-hrv-2020-all-lost-changhua.html" },
            { "car": "FORD FOCUS", "label": "南投埔里全丟救援", "img": "img/ford-focus-puli/front-with-key.jpg", "link": "/article-ford-focus-puli-akl.html" },
            { "car": "BMW 118", "label": "台中北屯全丟救援", "img": "img/bmw-118-beitun/front-with-keys.jpg", "link": "/article-bmw-118-beitun-akl.html" },
            { "car": "BMW 740", "label": "苗栗苑裡全丟救援", "img": "img/bmw-740-yuanli/on-site-tech.jpg", "link": "/article-bmw-740-yuanli-akl.html" },
            { "car": "MINI CLUBMAN", "label": "彰化北斗全丟救援", "img": "img/mini-clubman/beidou-akl.jpg", "link": "/article-mini-clubman-beidou-akl.html" }
        ];"""

# 由於舊代碼可能已經混亂，我們直接尋找陣列結構並替換
content = re.sub(r'const latestCases = \[.*?\];', new_cases, content, flags=re.DOTALL)

# 3. 修正 H1 標題
old_h1_pattern = r'<h1 class="font-serif-tc text-4xl md:text-8xl font-bold text-white leading-tight mb-8">.*?</h1>'
new_h1 = """<h1 class="font-serif-tc text-4xl md:text-8xl font-bold text-white leading-tight mb-8">
                沒鑰匙，找極致。<br>
                <span class="text-gold-lux italic text-xl md:text-5xl">全台 24H 現場匹配，免拖吊一小時啟動</span>
            </h1>"""
content = re.sub(old_h1_pattern, new_h1, content, flags=re.DOTALL)

# 4. 修復數據看板文字亂碼 (累積解碼車輛等)
content = content.replace("累??車?", "累積解碼車輛")
content = content.replace("?台???援", "全台遠征救援")
content = content.replace("覆?汽???", "覆蓋汽車品牌")
content = content.replace("24H ?年??", "24H 全年無休")
content = content.replace("??解碼實?", "最新解碼實績")

# 寫回檔案，確保 UTF-8
with open(path, "w", encoding="utf-8") as f:
    f.write(content)
