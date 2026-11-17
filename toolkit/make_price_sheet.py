import json, os, math
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
import sys
B = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, B)
import offer
from cards2 import CARDS
items = {i["code"]: i for i in offer.load_json("items2.json") if i.get("code") and i["code"] != "Diwan Item Number"}
PER_PAGE = 6
order = [k for k, *_ in offer.CATS if any(c["cat"] == k for c in CARDS)]
names = {k: en for k, _, _, en, _ in offer.CATS}
# flyer page of each card (page 1 = index), same split as build_full.cat_pages
page, pg_of = 2, {}
for k in order:
    cs = [c for c in CARDS if c["cat"] == k]
    kp = math.ceil(len(cs) / PER_PAGE); base, extra = divmod(len(cs), kp)
    sizes = [base + (1 if i < extra else 0) for i in range(kp)]
    i0 = 0
    for p, sz in enumerate(sizes):
        for c in cs[i0:i0 + sz]: pg_of[id(c)] = page + p
        i0 += sz
    page += kp

wb = openpyxl.Workbook()
ws = wb.active; ws.title = "Prices"
hdr = ["Card #", "Flyer page", "Category", "Card name (flyer)", "Diwan Item Number", "English Description",
       "Arabic Description", "UOM", "Promo Price", "Currency (USD / LBP)", "Saving %", "Marketing Comment"]
ws.append(hdr)
red = PatternFill("solid", fgColor="A12222"); yellow = PatternFill("solid", fgColor="FFF4C2")
band = PatternFill("solid", fgColor="F5F5F2"); thin = Side(style="thin", color="D9D6D0")
for c in ws[1]:
    c.font = Font(bold=True, color="FFFFFF"); c.fill = red
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
n = 0
for k in order:
    for c in [c for c in CARDS if c["cat"] == k]:
        n += 1
        for code in c["codes"]:
            it = items[code]
            ws.append([n, pg_of[id(c)], names[k], c["en"], code, it["en"], it["ar"], it["uom"], None, "USD", None, it["note"]])
            r = ws.max_row
            for cell in ws[r]:
                cell.border = Border(bottom=thin)
                if n % 2 == 0: cell.fill = band
            for col in ("I", "J", "K"): ws[f"{col}{r}"].fill = yellow
            ws[f"I{r}"].number_format = "#,##0.00"; ws[f"K{r}"].number_format = "0%"
            ws[f"G{r}"].alignment = Alignment(horizontal="right")
dv = DataValidation(type="list", formula1='"USD,LBP"', allow_blank=True); ws.add_data_validation(dv); dv.add(f"J2:J{ws.max_row}")
for col, w in zip("ABCDEFGHIJKL", [7, 9, 17, 32, 16, 46, 44, 7, 12, 12, 10, 16]): ws.column_dimensions[col].width = w
ws.freeze_panes = "A2"; ws.auto_filter.ref = f"A1:L{ws.max_row}"; ws.row_dimensions[1].height = 32

# photos sheet
ps = wb.create_sheet("Photos to check")
ps.append(["Card name", "Diwan Item Number(s)", "Issue"])
for c in ps[1]: c.font = Font(bold=True, color="FFFFFF"); c.fill = red
for c in CARDS:
    if not c["img"]: ps.append([c["en"], " ".join(c["codes"]), "No photo in the product library – please supply"])
# photo_notes.json (optional, written in the images stage): {"<card English name>": "<issue>"}
notes = offer.load_json("photo_notes.json") if os.path.exists(offer.path("photo_notes.json")) else {}
for en, why in notes.items():
    c = next((c for c in CARDS if c["en"] == en), None)
    ps.append([en, " ".join(c["codes"]) if c else "", why])
for col, w in zip("ABC", [34, 40, 60]): ps.column_dimensions[col].width = w

# how-to sheet
hs = wb.create_sheet("How to use", 0)
for line in [f"Diwan {offer.OFFER_NAME_EN} {offer.DATES_EN} – price entry",
             "",
             "1. Fill the yellow columns on the 'Prices' sheet: Promo Price, Currency (USD or LBP), and Saving % if you want a 'وفّر' badge.",
             "2. Rows with the same Card # share one card on the flyer (flavours). Give them the same price, or tell us to split the card.",
             "3. LBP prices: type the full number (e.g. 94999). The flyer shows it as 94.999L.L.",
             "4. Send the file back and the flyer is regenerated with the prices in place of X.XX.",
             "5. 'Photos to check' lists products with a missing or mismatched photo."]:
    hs.append([line])
hs["A1"].font = Font(bold=True, size=14, color="A12222"); hs.column_dimensions["A"].width = 120
os.makedirs(offer.path("out"), exist_ok=True)
out = offer.path("out", offer.file_name("Price-Sheet.xlsx"))
wb.save(out); print(out, n, "cards", ws.max_row - 1, "rows")
