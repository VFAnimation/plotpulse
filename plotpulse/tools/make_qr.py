"""
Makes one QR code per hoarding / brochure batch, so the dashboard can show
which one brings visitors.

  pip install "qrcode[pil]"
  python tools/make_qr.py https://vfanimation.github.io/plotpulse/

Reads tools/qr_sources.csv (id,label) and writes to qr-codes/:
  <id>.png  1600 px, for printing on brochures and flex
  <id>.svg  vector, scales to any hoarding size
  links.csv the exact link inside each QR code

Rules for printing: keep the QR at least 2.5 cm wide on paper, and on a
hoarding at least 1/10 of the distance it is read from (read from 10 m → 1 m wide).
Keep a white margin around it and test-scan the final print file before it goes out.
"""
import csv, os, sys
import qrcode
import qrcode.image.svg

if len(sys.argv) < 2:
    sys.exit("Usage: python tools/make_qr.py <public page URL>")
base = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, "qr-codes")
os.makedirs(out, exist_ok=True)
sep = "&" if "?" in base else "?"

rows = []
with open(os.path.join(root, "tools", "qr_sources.csv"), newline="") as f:
    for r in csv.DictReader(f):
        sid = r["id"].strip().lower()
        url = f"{base}{sep}src={sid}"
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=40, border=4)
        qr.add_data(url); qr.make(fit=True)
        qr.make_image(fill_color="black", back_color="white").save(os.path.join(out, sid + ".png"))
        qr.make_image(image_factory=qrcode.image.svg.SvgPathImage).save(os.path.join(out, sid + ".svg"))
        rows.append((sid, r["label"], url))
        print(f"{sid:28s} {url}")

with open(os.path.join(out, "links.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(["id", "label", "link"]); w.writerows(rows)
