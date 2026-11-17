"""Rebuild a Diwan-style offer sheet (.xlsx) from toolkit/items2.json, for dry runs.

The 6-9 Nov source sheet isn't in the toolkit zips, only its JSON conversion. This writes the standard
columns (Page, Division, Diwan Item Number, English Description, UOM, Arabic Description, Marketing Comment,
New RRP TTC, Customer Saving, Price In 200G) so the intake stage sees a sheet like the ones Diwan sends.

Usage: py -3 test/fixtures/make_sheet.py [out.xlsx]
"""
import json, os, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data", "fixtures", "Weekend Offers 6-9 Nov.xlsx")
rows = json.load(open(os.path.join(ROOT, "toolkit", "items2.json"), encoding="utf-8"))
keys = ["page", "div", "code", "en", "uom", "ar", "note", "price", "saving", "p200"]
header = ["Page", "Division", "Diwan Item Number", "English Description", "UOM", "Arabic Description",
          "Marketing Comment (Added / Removed)", "New RRP TTC", "Customer Saving", "Price In 200G"]

wb = Workbook(); ws = wb.active; ws.title = "Weekend Offers"
ws.append(header)
for c in ws[1]: c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="A12222")
n = 0
for r in rows:
    if not r.get("code") or r["code"] == "Diwan Item Number": continue
    ws.append([r.get(k) for k in keys]); n += 1
for col, w in zip("ABCDEFGHIJ", [6, 10, 16, 40, 8, 40, 22, 12, 14, 12]): ws.column_dimensions[col].width = w
os.makedirs(os.path.dirname(out), exist_ok=True)
wb.save(out)
print(out, n, "rows")
