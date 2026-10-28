"""
Builds colony/plots.json for Chohak Land from measurements taken off the
AutoCAD layout PDF (CHOHAK_LAND_SUMIT-Model.pdf).

All positions are in the PDF's own units (points, about 3.017 points per foot),
shifted so the map starts at 0,0. Re-run after changing anything here:

  python3 tools/build_chohak_plan.py

Plot details here (size, facing, corner) are read off the drawing. When the
builder sends his plot sheet, use tools/update_plots_from_csv.py to overwrite them.
"""
import json, os

OX, OY = 150, 92            # crop origin (PDF points)
W, H = 2085, 1160           # map size
FT = 3.0166                 # points per foot

def P(x, y): return (round(x - OX, 1), round(y - OY, 1))
def rect(x0, y0, x1, y1):
    a, b = P(x0, y0), P(x1, y1)
    return {"x": a[0], "y": a[1], "w": round(b[0] - a[0], 1), "h": round(b[1] - a[1], 1)}
def pts(*xy): return " ".join(f"{P(x, y)[0]},{P(x, y)[1]}" for x, y in xy)

units = []
def unit(no, kind, x0, y0, x1, y1, w_ft, d_ft, facing, corner=False, park=False, status="available"):
    sqft = round(w_ft * d_ft)
    u = {"no": str(no), "kind": kind, **rect(x0, y0, x1, y1),
         "sqft": sqft, "gaj": round(sqft / 9, 1),
         "dims": f"{fmt(w_ft)} × {fmt(d_ft)} ft", "facing": facing,
         "corner": corner, "parkFacing": park, "status": status}
    units.append(u)
def fmt(v):
    return str(int(v)) if float(v).is_integer() else f"{v:g}"

# ---- Top row, plots 49–68 (25 × 50 ft, road on the west side) ----
xs = [502.5, 577.9, 653.5, 728.9, 804.3, 879.7, 955.3, 1030.8, 1106.2, 1181.6, 1257.2,
      1332.6, 1408.0, 1483.5, 1559.1, 1634.5, 1709.9, 1785.3, 1860.9, 1936.3, 2027.2]
for i in range(20):
    no = 49 + i
    unit(no, "plot", xs[i], 141, xs[i + 1], 292.2, 25, 50, "West", park=(no == 49))

# ---- Middle block ----
mx = [614.2, 686.6, 759.1, 831.5, 904.0, 976.4, 1048.9, 1121.3, 1193.8, 1266.2, 1338.7,
      1411.1, 1483.5, 1556.0, 1628.4, 1700.9, 1773.3, 1845.8, 1921.2]
for i in range(18):
    w = 25 if i == 17 else 24
    unit(48 - i, "plot", mx[i], 382.8, mx[i + 1], 539.7, w, 52, "East", corner=(i == 17))   # 48 … 31
    unit(13 + i, "plot", mx[i], 539.7, mx[i + 1], 696.9, w, 52, "West", corner=(i == 17))   # 13 … 30
ys = [382.8, 461.3, 539.7, 618.2, 696.9]
for i in range(4):   # 9–12, 26 × 51 ft, face the road on the north
    unit(9 + i, "plot", 460.2, ys[i], 614.2, ys[i + 1], 26, 51, "North", corner=(i in (0, 3)))

# ---- Plots 5–8 below the park (24 × 50 ft, road on the south side) ----
ys = [497.6, 570.0, 642.5, 714.9, 787.4]
for i, no in enumerate([8, 7, 6, 5]):
    unit(no, "plot", 218, ys[i], 369.6, ys[i + 1], 24, 50, "South", park=(no == 8))

# ---- South-west block: plots 4–1 and shops 1–10 ----
xs = [816.4, 892.0, 967.4, 1042.8, 1118.2]
for i, no in enumerate([4, 3, 2, 1]):
    unit(no, "plot", xs[i], 787.4, xs[i + 1], 923.1, 25, 45, "East", corner=(no == 1))
sx = [816.4, 846.6, 876.9, 906.9, 937.2, 967.4, 997.6, 1027.7, 1057.9, 1088.2, 1118.2]
for i in range(10):
    unit(f"S{i + 1}", "shop", sx[i], 923.1, sx[i + 1], 998.7, 10, 25, "West", corner=(i in (0, 9)))

# ---- South-east block: E.W.S. plots 81–73, shops 11–22, plot 72 ----
xs = [1239.0, 1299.5, 1359.8, 1420.1, 1480.6, 1540.9, 1601.4, 1661.7, 1722.0, 1785.3]
for i, no in enumerate(range(81, 72, -1)):
    unit(no, "ews", xs[i], 787.4, xs[i + 1], 923.1, 21 if no == 73 else 20, 45, "East",
         status="reserved")
sx = [1239.0, 1269.3, 1299.5, 1329.6, 1359.8, 1390.0, 1420.1, 1450.3, 1480.6, 1510.6,
      1540.9, 1571.1, 1601.4]
for i in range(12):
    unit(f"S{11 + i}", "shop", sx[i], 923.1, sx[i + 1], 998.7, 10, 25, "West", corner=(i == 0))
unit(72, "plot", 1649.6, 923.1, 1785.3, 1013.7, 45, 30, "South", corner=True)

# ---- East corner: plots 70, 69, 71 ----
unit(70, "plot", 1876.0, 787.4, 1943.9, 938.3, 22.5, 50, "East", corner=True)
unit(69, "plot", 1943.9, 787.4, 2011.8, 938.3, 22.5, 50, "East")
unit(71, "plot", 1876.0, 938.3, 2011.8, 1009.9, 45, 23.75, "North", corner=True)

# Sample: a few units already allotted, so the demo looks like a launched project.
SAMPLE_ALLOTTED = {"50", "52", "57", "63", "33", "36", "40", "16", "21", "27", "9", "2", "70", "S3", "S4", "S14", "S15"}
for u in units:
    if u["no"] in SAMPLE_ALLOTTED: u["status"] = "allotted"

# ---- Site ----
def by(x): return 1090 + (x - 805) * (-65 / 1360)   # boundary along the main road (slanted)
boundary = pts((218, 141), (2027.2, 141), (2027.2, 604), (2165, 604), (2165, by(2165)),
               (805, by(805)), (805, 787.4), (218, 787.4))
road_main = pts((OX, by(OX) + 6), (OX + W, by(OX + W) + 6), (OX + W, by(OX + W) + 126), (OX, by(OX) + 126))

blocks = [  # raised bases the plots sit on
    {**rect(218, 141, 2027.2, 292.2), "rx": 6},
    {**rect(460.2, 382.8, 1921.2, 696.9), "rx": 14},
    {**rect(218, 497.6, 369.6, 787.4), "rx": 6},
    {**rect(816.4, 787.4, 1118.2, by(1118.2) - 2), "rx": 8},
    {**rect(1239.0, 787.4, 1785.3, by(1785.3) - 2), "rx": 8},
    {**rect(1876.0, 787.4, 2011.8, by(2011.8) - 2), "rx": 8},
    {**rect(2011.8, 604, 2165, by(2165) - 2), "rx": 8},
]
features = [
    {"kind": "park", "label": "Park", "sub": "900 gaj",
     "points": pts((218, 141), (502.5, 141), (502.5, 292.2), (369.6, 292.2), (369.6, 497.6), (218, 497.6)),
     "labelX": P(294, 0)[0], "labelY": P(0, 330)[1]},
    {"kind": "amenity", "style": "community", "label": "Community", "label2": "centre", **rect(2016, 712, 2161, by(2161) - 6)},
    {"kind": "amenity", "style": "stp", "label": "STP /", "label2": "garbage", **rect(2016, 608, 2161, 707)},
    {"kind": "amenity", "style": "parking", "label": "Parking", **rect(816.4, 998.7, 1118.2, by(1118.2) - 2)},
    {"kind": "amenity", "style": "parking", "label": "Parking", **rect(1239.0, 998.7, 1601.4, by(1601.4) - 2)},
    {"kind": "amenity", "style": "utility", "label": "E.G.S", **rect(1601.4, 923.1, 1649.6, by(1649.6) - 2)},
]
labels = [
    {"text": "30 FT ROAD", **dict(zip("xy", P(1200, 340)))},
    {"text": "30 FT ROAD", **dict(zip("xy", P(1200, 745)))},
    {"text": "30 FT ROAD", **dict(zip("xy", P(415, 640))), "rotate": -90},
    {"text": "30 FT ROAD", **dict(zip("xy", P(1966, 545))), "rotate": -90},
    {"text": "40 FT ROAD", **dict(zip("xy", P(1178.6, 880))), "rotate": -90},
    {"text": "30 FT", **dict(zip("xy", P(1830.6, 880))), "rotate": -90},
]
main_label = {"text": "MAIN ROAD (40 FT)", **dict(zip("xy", P(600, by(600) + 72))), "rotate": -2.74}
gate = dict(zip("xy", P(1178.6, by(1178.6) + 2)))
trees = []   # decorative trees along the boundary and inside the park
for x in range(560, 2000, 70): trees.append(P(x, 128))
for y in range(170, 780, 70): trees.append(P(206, y))
for x, y in [(250, 180), (330, 175), (460, 180), (250, 255), (340, 250), (335, 425), (245, 470), (345, 470), (245, 420), (420, 230)]:
    trees.append(P(x, y))

plan = {
    "viewBox": [0, 0, W, H],
    "compass": {"up": "E", "x": W - 70, "y": 70},
    "boundary": boundary, "mainRoad": road_main, "mainRoadLabel": main_label,
    "blocks": blocks, "features": features, "labels": labels, "gate": gate,
    "trees": [list(t) for t in trees], "units": units,
}
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, "colony", "plots.json")
# keep statuses already set in an existing file
try:
    old = {u["no"]: u.get("status") for u in json.load(open(out)).get("units", [])}
    for u in units:
        if old.get(u["no"]) and u["kind"] != "ews": u["status"] = old[u["no"]]
except Exception:
    pass
json.dump(plan, open(out, "w"), indent=1, ensure_ascii=False)
kinds = {}
for u in units: kinds[u["kind"]] = kinds.get(u["kind"], 0) + 1
print("Wrote", out, kinds)
