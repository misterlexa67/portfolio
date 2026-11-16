import os
from PIL import Image
SRC=r"d:\portfolio\delivery\assets"; OUT=os.path.join(SRC,"cut","covers"); os.makedirs(OUT,exist_ok=True)
b=Image.open(os.path.join(SRC,"cover Сочный чизбургер в драматичном свете.png")).convert("RGB")
b.thumbnail((1600,1600),Image.LANCZOS); b.save(os.path.join(OUT,"burgers.webp"),"WEBP",quality=80,method=6)
s=Image.open(os.path.join(SRC,"cover Суши и азиатская лапша.png")).convert("RGB")
W,H=s.size
# find the thin divider: darkest/most uniform column near the middle
import numpy as np
arr=np.asarray(s.convert("L"),dtype=float)
mid=range(int(W*0.45),int(W*0.55))
col=min(mid,key=lambda x: arr[:,x].std()+abs(arr[:,x].mean()-arr[:,x-3].mean())*0)
print("split at",col,W)
l=s.crop((0,0,col-4,H)); r=s.crop((col+5,0,W,H))
for img,name in [(l,"sushi.webp"),(r,"wok.webp")]:
    img.thumbnail((1200,1200),Image.LANCZOS); img.save(os.path.join(OUT,name),"WEBP",quality=80,method=6)
    print(name,img.size)
