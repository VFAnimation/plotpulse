"""
Copies the builder's plot sheet into colony/plots.json.

  python3 tools/update_plots_from_csv.py my_plot_sheet.csv

Save the builder's Excel as CSV with these columns (see plot_sheet_template.csv):
  unit_no      plot number, or S1, S2 ... for shops
  type         plot, shop or ews
  width_ft     front width in feet
  depth_ft     depth in feet
  facing       East / West / North / South
  corner       Y or N
  park_facing  Y or N
  status       available or allotted (ews rows are always reserved)

Area is worked out from width x depth, in sq ft and gaj (1 gaj = 9 sq ft).
Where each unit sits on the map comes from tracing the master plan, not from
the sheet; rows are matched to the map by unit_no.
"""
import csv, json, os, sys

if len(sys.argv) < 2:
    sys.exit("Usage: python3 tools/update_plots_from_csv.py <sheet.csv>")
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(root, "colony", "plots.json")
data = json.load(open(path))
by_no = {u["no"].upper(): u for u in data["units"]}
yes = lambda v: str(v).strip().lower() in ("y", "yes", "true", "1")
fmt = lambda v: str(int(v)) if float(v).is_integer() else f"{v:g}"

updated, missing = 0, []
with open(sys.argv[1], newline="", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        no = str(r["unit_no"]).strip().upper()
        u = by_no.get(no)
        if not u:
            missing.append(no); continue
        w, d = float(r["width_ft"]), float(r["depth_ft"])
        sqft = round(w * d)
        kind = r.get("type", u["kind"]).strip().lower() or u["kind"]
        u.update({
            "kind": kind,
            "sqft": sqft,
            "gaj": round(sqft / 9, 1),
            "dims": f"{fmt(w)} × {fmt(d)} ft",
            "facing": r["facing"].strip().title(),
            "corner": yes(r["corner"]),
            "parkFacing": yes(r["park_facing"]),
            "status": "reserved" if kind == "ews" else ("allotted" if r["status"].strip().lower() == "allotted" else "available"),
        })
        updated += 1

json.dump(data, open(path, "w"), indent=1, ensure_ascii=False)
print(f"Updated {updated} units in colony/plots.json")
if missing:
    print("Not on the map (no shape traced yet):", ", ".join(missing))
