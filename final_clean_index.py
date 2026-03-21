import re
path = r"C:\Users\ottoy\.openclaw\workspace-carkey\workspace-carkey\procore-repo\index.html"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()
pattern = r'\{\s*"car":\s*"VW Ignition".*?\},'
matches = list(re.finditer(pattern, content, flags=re.DOTALL))
if len(matches) > 1:
    for m in reversed(matches[1:]):
        content = content[:m.start()] + content[m.end():]
with open(path, "w", encoding="utf-8") as f:
    f.write(content)
