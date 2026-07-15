import json
with open("blog.json", "r", encoding="utf-8") as f:
    data = f.read()

with open("blog.html", "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

import re
# 使用正則替換，完全無視轉義問題
new_content = re.sub(r"const blogData = \[.*?\];", f"const blogData = {data};", content, flags=re.DOTALL)

with open("blog.html", "w", encoding="utf-8") as f:
    f.write(new_content)
