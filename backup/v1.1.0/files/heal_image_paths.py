import os
import re
import sys
import io

# 強制 UTF-8 輸出
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def heal_paths():
    # 1. 取得所有實體圖片清單 (小寫處理以便比對)
    img_dir = 'img'
    if not os.path.exists(img_dir):
        print(f"❌ 錯誤: 找不到 {img_dir} 目錄")
        return

    real_images = os.listdir(img_dir)
    print(f"🔍 掃描到 {len(real_images)} 個實體圖片檔案")

    # 2. 定義掃描與修復邏輯
    html_files = [f for f in os.listdir('.') if f.endswith('.html')]
    repair_count = 0

    for html_file in html_files:
        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content
        
        # 尋找所有 img src
        img_tags = re.findall(r'<img [^>]*src="([^"]+)"', content)
        
        for src in img_tags:
            # 取得純檔名 (移除目錄與副檔名)
            base_name = os.path.basename(src).split('.')[0]
            
            # 檢查路徑是否真實存在
            if not os.path.exists(src):
                # 嘗試在 img/ 中尋找匹配的檔案
                match = None
                
                # 策略 A: 精確匹配檔名 (忽略大小寫與副檔名)
                for real_img in real_images:
                    if real_img.lower().startswith(base_name.lower()):
                        match = f"img/{real_img}"
                        break
                
                # 策略 B: 特殊對照 (處理舊路徑)
                if not match:
                    if 'bmw' in base_name.lower() and 'taichung' in base_name.lower():
                        match = 'img/bmw_taichung_new.jpg'
                    elif 'benz' in base_name.lower():
                        match = 'img/benz_changhua_new.jpg'
                    elif 'toyota' in base_name.lower() and 'nantou' in base_name.lower():
                        match = 'img/toyota_nantou_new.jpg'

                if match:
                    print(f"🔧 修復 [{html_file}]: {src} -> {match}")
                    content = content.replace(src, match)
                    repair_count += 1
                else:
                    print(f"⚠️ 無法自動修復 [{html_file}]: {src} (找不到匹配檔案)")

        if content != original_content:
            with open(html_file, 'w', encoding='utf-8') as f:
                f.write(content)

    print("-" * 50)
    print(f"✅ 自癒完成！共修復 {repair_count} 個圖片路徑。")

if __name__ == "__main__":
    heal_paths()
