import os
CUT=r"d:\portfolio\delivery\assets\cut"
M={
"burgers":"classic bacon crispy-chicken double-pickles grand chicken-cheese fries wedges nuggets onion-rings lemonade milkshake ketchup garlic-sauce",
"sushi":"nigiri-salmon nigiri-tuna nigiri-shrimp nigiri-eel maki-salmon california philadelphia unagi-roll baked-salmon baked-eel red-dragon tempura-roll gunkan-ikura gunkan-spicy gunkan-chuka ginger wasabi",
"shawarma":"shawarma-chicken shawarma-beef shawarma-spicy shawarma-falafel wok-beef rice-shrimp wok-shrimp rice-lamb khinkali tom-yum chuka-salad spring-rolls",
"coffee":"cappuccino iced-latte mocha americano caramel-frappe red-velvet cheesecake fondant macaron croissant",
"healthy":"chicken-bowl poke-salmon caprese green-smoothie berry-smoothie feta-salad granola-bowl",
}
for slug,names in M.items():
    names=names.split()
    files=sorted(f for f in os.listdir(os.path.join(CUT,slug)) if f[:2].isdigit())
    assert len(files)==len(names),(slug,len(files),len(names))
    for f,n in zip(files,names):
        os.replace(os.path.join(CUT,slug,f),os.path.join(CUT,slug,n+".webp"))
print("ok")
