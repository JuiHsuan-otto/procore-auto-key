import json
path = r"C:\Users\ottoy\.openclaw\workspace-carkey\workspace-carkey\procore-repo\blog.json"
with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)
seen = set()
unique = []
for e in data:
    if e.get("link") not in seen:
        unique.append(e)
        seen.add(e.get("link"))
with open(path, "w", encoding="utf-8") as f:
    json.dump(unique, f, ensure_ascii=False, indent=2)
