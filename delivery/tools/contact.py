import os, glob
from PIL import Image
CUT=r"d:\portfolio\delivery\assets\cut"
groups=[("burgers","Бургеры"),("sushi","Суши"),("shawarma","Шаурма и вок"),("coffee","Кофе и десерты"),("healthy","Полезное"),("covers","Обложки")]
parts=[]; total=0
for slug,title in groups:
    files=sorted(glob.glob(os.path.join(CUT,slug,"*.webp")),key=os.path.getmtime)
    cells=[]
    for f in files:
        im=Image.open(f); kb=os.path.getsize(f)//1024; n=os.path.basename(f)
        cells.append(f'<figure><div class="ck"><img src="{slug}/{n}" alt="" loading="lazy"></div><figcaption><b>{n}</b><span>{im.width}×{im.height} · {kb} КБ</span></figcaption></figure>')
        total+=1
    parts.append(f'<section><h2>{title} <small>{slug}/ · {len(files)}</small></h2><div class="grid{" wide" if slug=="covers" else ""}">{"".join(cells)}</div></section>')
html=f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Нарезка блюд</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{{--bg:#FAF9F7;--ink:#1C1A19;--mute:#7A7470;--line:#ECE8E4;--acc:#702D3B}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 Manrope,system-ui,sans-serif;padding:32px 16px 64px}}
header{{max-width:1240px;margin:0 auto 24px}}h1{{font-size:28px;margin:0 0 4px;letter-spacing:-.02em}}h1 b{{color:var(--acc)}}header p{{margin:0;color:var(--mute)}}
section{{max-width:1240px;margin:0 auto 36px}}h2{{font-size:18px;margin:0 0 12px}}h2 small{{color:var(--mute);font-weight:400;font-size:13px;margin-left:6px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}}.grid.wide{{grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}}
figure{{margin:0;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}}
.ck{{aspect-ratio:1;display:grid;place-items:center;padding:10px;background-color:#fff;background-image:linear-gradient(45deg,#e9e6e2 25%,transparent 25%),linear-gradient(-45deg,#e9e6e2 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e9e6e2 75%),linear-gradient(-45deg,transparent 75%,#e9e6e2 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0}}
.wide .ck{{aspect-ratio:4/3;padding:0}}.ck img{{max-width:100%;max-height:100%;object-fit:contain;display:block}}.wide .ck img{{width:100%;height:100%;object-fit:cover}}
figcaption{{padding:8px 10px;font-size:12px;display:flex;justify-content:space-between;gap:6px;color:var(--mute);font-variant-numeric:tabular-nums}}figcaption b{{color:var(--ink)}}
</style></head><body><header><h1>доставка<b>.</b>есть — нарезка</h1><p>{total} файлов · прозрачный фон, WebP · служебная страница</p></header>{"".join(parts)}</body></html>'''
open(os.path.join(CUT,"contact-sheet.html"),"w",encoding="utf-8").write(html)
print(total)
