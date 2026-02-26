import os

# 定義文章與正確照片的對應表
MAPPING = {
    "article-bmw-fem-advanced-tech.html": ["bmw_fem_board.jpg", "bmw_fem_1.jpg", "bmw_fem_2.jpg"],
    "article-vw-pointer-xianxi-rescue.html": ["vw_pointer_rear.jpg", "vw_pointer_interior.jpg", "vw_pointer_ecu_pcb.jpg"],
    "article-vw-t5-kaohsiung-rescue.html": ["vw_t5_kaohsiung.jpg"],
    "article-vw-golf-dadu-service.html": ["vw_golf_dadu.jpg"],
    "article-honda-fit-tanaka-rescue.html": ["honda_fit_tanaka.jpg"],
    "article-skoda-kodiaq-yunlin-rescue.html": ["skoda-kodiaq-rescue.jpg"],
    "article-lexus-taichung-service.html": ["jap_02.jpg"], # Lexus 選用具備質感的日系內裝照
    "article-us-car-market-tech.html": ["american_car_real.jpg"],
    "article-toyota-rav4-linkou-rescue.html": ["toyota-rav4-linkou.jpg"],
    "article-decoding-equipment.html": ["bmw_fem_board.jpg"],
    "article-keyless-troubleshooting.html": ["ger_10.jpg"]
}

def heal_visuals():
    for article, photos in MAPPING.items():
        if not os.path.exists(article): continue
        
        with open(article, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 使用正則表達式尋找所有的 img src="img/..." 並進行替換
        import re
        
        # 尋找內容中的 img src 並依序替換為正確的照片
        matches = re.findall(r'src="img/([^"]+)"', content)
        
        new_content = content
        for i, old_photo in enumerate(matches):
            if i < len(photos):
                new_photo = photos[i]
                if old_photo != new_photo:
                    new_content = new_content.replace(f'src="img/{old_photo}"', f'src="img/{new_photo}"')
                    print(f"✅ {article}: {old_photo} -> {new_photo}")
        
        with open(article, 'w', encoding='utf-8') as f:
            f.write(new_content)

if __name__ == "__main__":
    heal_visuals()
