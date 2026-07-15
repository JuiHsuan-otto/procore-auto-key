import os

# 定義需要遮蔽的技術/設備名稱
TECH_MASK_MAPPING = {
    "Magneti Marelli": "歐系核心電腦單元",
    "IAW 1AV": "專用控制系統",
    "EIS/EZS": "電子啟動模組",
    "EIS": "電子啟動模組",
    "EZS": "電子啟動模組",
    "MQB 平台": "德系精密防盜架構",
    "MQB 系統": "精密防盜系統",
    "MQB": "德系精密架構",
    "PATS 系統": "美系防盜安全系統",
    "EEPROM": "底層記憶晶片",
    "ISN 碼": "核心加密授權碼",
    "ISN": "核心加密碼",
    "ICOM Pro": "專業高階通訊介面",
    "VAS 6154": "專用診斷通訊系統",
    "MB SD Connect C4": "專業高階診斷系統",
    "Techstream Pro": "專用高階診斷系統",
    "HDS 診斷器": "專業技術診斷器",
    "Consult III": "專業高階診斷系統",
    "IDS 設備": "專業診斷器材"
}

def cleanup_tech_names():
    files = [f for f in os.listdir('.') if f.startswith('article-') and f.endswith('.html')]
    
    for filename in files:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = content
        for old, new in TECH_MASK_MAPPING.items():
            new_content = new_content.replace(old, new)
        
        if new_content != content:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"CLEANED: Removed sensitive tech names in {filename}")

if __name__ == "__main__":
    cleanup_tech_names()
