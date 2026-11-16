import sys, os, glob, json
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
from rembg import remove, new_session
from scipy import ndimage

SRC = r"d:\portfolio\delivery\assets"
OUT = os.path.join(SRC, "cut")
DBG = os.path.dirname(os.path.abspath(__file__))

SHEETS = {
    "burgers": "menu фастфуда на тёмном фоне.png",
    "sushi": "menu суши на тёмном фоне.png",
    "shawarma": "menu восточной кухни.png",
    "coffee": "menu coffe напитки и десерты.png",
    "healthy": "menu полезных блюд и смузи.png",
}

model = sys.argv[1] if len(sys.argv) > 1 else "isnet-general-use"
only = sys.argv[2:] or list(SHEETS)
session = new_session(model)
report = {}

for slug in only:
    path = os.path.join(SRC, SHEETS[slug])
    im = Image.open(path).convert("RGB")
    cut = remove(im, session=session, post_process_mask=True)  # RGBA
    a = np.array(cut)[:, :, 3]
    np.save(os.path.join(DBG, f"alpha_{slug}.npy"), a)
    mask = a > 128
    lab0, n0 = ndimage.label(mask)
    H, W = a.shape
    areas = ndimage.sum(mask, lab0, range(1, n0 + 1))
    big = np.zeros_like(mask)
    for i, ar in enumerate(areas, 1):
        if ar > H * W * 0.004:
            big |= lab0 == i
    ero = ndimage.binary_erosion(mask, iterations=20)
    mk, nm = ndimage.label(ero)
    mar = ndimage.sum(ero, mk, range(1, nm + 1))
    markers = np.zeros_like(mk); sid = 0
    for i, ar in enumerate(mar, 1):
        if ar > H * W * 0.002:
            sid += 1; markers[mk == i] = sid
    _, (my, mx) = ndimage.distance_transform_edt(markers == 0, return_indices=True)
    seeds = np.where(big, markers[my, mx], 0)
    # nearest seed for every pixel + distance to it
    dist, (iy, ix) = ndimage.distance_transform_edt(seeds == 0, return_indices=True)
    near = seeds[iy, ix]
    lab = np.zeros_like(lab0)
    for i, ar in enumerate(areas, 1):
        comp = lab0 == i
        if ar > H * W * 0.004:
            lab[comp] = seeds[comp]
        elif ar > 60:
            d = dist[comp].min()
            if d < 22:
                lab[comp] = np.bincount(near[comp]).argmax()
    override = {}
    if slug == "healthy":  # straw of green smoothie overlaps the bowl above it
        import cv2
        bowl, cup = lab[250, 250], lab[650, 180]
        lum = np.asarray(im.convert("L"))
        straw = np.zeros_like(mask); straw[330:440, 172:216] = True
        straw &= (lum < 70) & (a > 128)
        over_bowl = straw.copy(); over_bowl[392:, :] = False
        over_bowl &= ndimage.binary_dilation(lab == bowl, iterations=0) | (lab == bowl)
        lab[straw] = cup
        lab[ndimage.binary_dilation(over_bowl, iterations=2) & ~straw & (lab == cup)] = bowl
        rgb = np.ascontiguousarray(np.array(cut)[:, :, :3][:, :, ::-1])
        fixed = cv2.inpaint(rgb, ndimage.binary_dilation(over_bowl, iterations=2).astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA)
        rb = np.array(cut).copy(); rb[:, :, :3] = fixed[:, :, ::-1]
        hole = ndimage.binary_dilation(over_bowl, iterations=2)
        rb[:, :, 3] = np.where(hole, 255, rb[:, :, 3])
        override[bowl] = (rb, hole)
    # per item: keep main body + nearby pieces only
    for v in range(1, lab.max() + 1):
        own = (lab == v) & mask
        if not own.any(): continue
        pl, pn = ndimage.label(own)
        if pn < 2: continue
        pa = ndimage.sum(own, pl, range(1, pn + 1))
        main = pl == (int(np.argmax(pa)) + 1)
        dmain = ndimage.distance_transform_edt(~main)
        for j, ar in enumerate(pa, 1):
            piece = pl == j
            if piece is main or (piece & main).any(): continue
            if ar < 150 or dmain[piece].min() > 22 or ar < pa.max() * 0.004 and dmain[piece].min() > 10:
                lab[piece] = 0
    # soft edges: extend each label 3px into semi-transparent fringe
    soft = a > 8
    grown = ndimage.grey_dilation(lab, size=7)
    lab = np.where((lab == 0) & soft, grown, lab)
    items = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl is None: continue
        ys, xs = sl
        items.append((ys.start, ys.stop, xs.start, xs.stop, i, 0))
    # row-major order: cluster by vertical centre
    items.sort(key=lambda t: (t[0] + t[1]) / 2)
    rows, cur = [], []
    for it in items:
        cy = (it[0] + it[1]) / 2
        if cur and cy - (cur[-1][0] + cur[-1][1]) / 2 > H * 0.12:
            rows.append(cur); cur = []
        cur.append(it)
    if cur: rows.append(cur)
    ordered = [it for r in rows for it in sorted(r, key=lambda t: t[2])]

    os.makedirs(os.path.join(OUT, slug), exist_ok=True)
    for f in glob.glob(os.path.join(OUT, slug, "*.webp")):
        os.remove(f)
    dbg = im.copy(); d = ImageDraw.Draw(dbg)
    rgba = np.array(cut)
    names = []
    for k, (y0, y1, x0, x1, i, area) in enumerate(ordered, 1):
        pad = 6
        y0p, y1p = max(0, y0 - pad), min(H, y1 + pad)
        x0p, x1p = max(0, x0 - pad), min(W, x1 + pad)
        srcarr = override[i][0] if i in override else rgba
        sub = srcarr[y0p:y1p, x0p:x1p].copy()
        keep = lab[y0p:y1p, x0p:x1p] == i
        if i in override: keep |= override[i][1][y0p:y1p, x0p:x1p]
        sub[:, :, 3] = np.where(keep, sub[:, :, 3], 0)
        piece = Image.fromarray(sub, "RGBA")
        bb = piece.getbbox()
        piece = piece.crop(bb)
        # fit into square-ish canvas with small margin, max 640px
        piece.thumbnail((640, 640), Image.LANCZOS)
        name = f"{k:02d}.webp"
        piece.save(os.path.join(OUT, slug, name), "WEBP", quality=82, method=6)
        names.append(name)
        d.rectangle([x0, y0, x1, y1], outline=(255, 0, 80), width=4)
        d.text((x0 + 8, y0 + 8), str(k), fill=(255, 255, 0))
    dbg.convert("RGB").resize((W // 2, H // 2)).save(os.path.join(DBG, f"dbg_{slug}.jpg"), quality=70)
    report[slug] = len(names)
    print(slug, len(names), flush=True)

print(json.dumps(report))
