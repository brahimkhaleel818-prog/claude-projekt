#!/usr/bin/env python3
"""
Agent-Check: rechnet aus Shopify-Bestellungen aus, was der China-Agent
(YLFulfilment) pro Bestellung und insgesamt berechnen darf.

Datenquelle (eine von beiden):
  1. Live aus Shopify:   SHOPIFY_SHOP=xxx.myshopify.com  SHOPIFY_ACCESS_TOKEN=shpat_...
  2. Gespeicherte GraphQL-Antworten:  --input pages/*.json

Beispiele:
  python3 agent_check.py --from 2026-09-01 --to 2026-09-30 --xlsx sept.xlsx
  python3 agent_check.py --from 2026-09-01 --to 2026-09-30 --invoice 1234.56
  python3 agent_check.py --orders "#213039,#212999" --input pages/*.json
  python3 agent_check.py --from 2026-09-01 --basis fulfilled
"""
import argparse, glob, json, os, sys, urllib.request
from collections import defaultdict
from datetime import datetime, date

HERE = os.path.dirname(os.path.abspath(__file__))
API_VERSION = "2025-07"

ORDER_QUERY = """
query($first: Int!, $q: String, $after: String) {
  orders(first: $first, query: $q, after: $after, sortKey: CREATED_AT, reverse: true) {
    edges { node {
      id name createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus
      customer { displayName }
      totalPriceSet { shopMoney { amount currencyCode } }
      totalRefundedSet { shopMoney { amount } }
      shippingAddress { countryCodeV2 country city zip }
      fulfillments { createdAt status trackingInfo { number company } }
      lineItems(first: 20) { edges { node {
        title quantity currentQuantity product { id } variant { id title }
        originalUnitPriceSet { shopMoney { amount } }
      } } }
    } }
    pageInfo { hasNextPage endCursor }
  }
}
"""

# ---------------------------------------------------------------- Wechselkurs
def fetch_rate():
    """Gibt (EUR pro 1 USD, Datum, Quelle) zurueck."""
    sources = [
        ("https://api.frankfurter.app/latest?from=USD&to=EUR",
         lambda d: (d["rates"]["EUR"], d["date"], "EZB via frankfurter.app")),
        ("https://open.er-api.com/v6/latest/USD",
         lambda d: (d["rates"]["EUR"], d["time_last_update_utc"][:16], "open.er-api.com")),
    ]
    for url, parse in sources:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "eveom-agent-check/1.0"})
            with urllib.request.urlopen(req, timeout=15) as r:
                return parse(json.load(r))
        except Exception as e:  # naechste Quelle probieren
            print(f"  Kursquelle {url} nicht erreichbar: {e}", file=sys.stderr)
    raise SystemExit("Kein Wechselkurs verfuegbar. Bitte --rate angeben.")

# ---------------------------------------------------------------- Shopify
def fetch_live(query_filter):
    shop = os.environ.get("SHOPIFY_SHOP"); token = os.environ.get("SHOPIFY_ACCESS_TOKEN")
    if not (shop and token):
        raise SystemExit("SHOPIFY_SHOP und SHOPIFY_ACCESS_TOKEN setzen, oder --input verwenden.")
    url = f"https://{shop}/admin/api/{API_VERSION}/graphql.json"
    orders, after = [], None
    while True:
        body = json.dumps({"query": ORDER_QUERY,
                           "variables": {"first": 50, "q": query_filter, "after": after}}).encode()
        req = urllib.request.Request(url, body, {"Content-Type": "application/json",
                                                 "X-Shopify-Access-Token": token})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r)
        if "errors" in data:
            raise SystemExit(f"Shopify-Fehler: {data['errors']}")
        page = data["data"]["orders"]
        orders += [e["node"] for e in page["edges"]]
        if not page["pageInfo"]["hasNextPage"]:
            return orders
        after = page["pageInfo"]["endCursor"]

def load_files(patterns):
    seen, orders = set(), []
    for pat in patterns:
        for f in sorted(glob.glob(pat)):
            with open(f) as fh:
                data = json.load(fh)
            for e in data["data"]["orders"]["edges"]:
                n = e["node"]
                if n["name"] not in seen:
                    seen.add(n["name"]); orders.append(n)
    return orders

# ---------------------------------------------------------------- Berechnung
def d(s):  # ISO-Zeitstempel -> date
    return datetime.fromisoformat(s.replace("Z", "+00:00")).date() if s else None

def cost_for_order(o, prices, product_kind):
    """Liefert eine Ergebniszeile (dict) fuer eine Bestellung."""
    addr = o.get("shippingAddress") or {}
    cc = addr.get("countryCodeV2") or "??"
    counts = defaultdict(int); unknown = []
    for e in o["lineItems"]["edges"]:
        li = e["node"]; pid = (li.get("product") or {}).get("id")
        qty = li.get("currentQuantity", li["quantity"])
        if qty is None: qty = li["quantity"]
        kind = product_kind.get(pid)
        if kind == "ignore" or qty == 0:
            continue
        if kind is None:
            unknown.append(f"{qty}x {li['title']}")
        else:
            counts[kind] += qty
    bottles = counts.get("astaxanthin", 0)
    pillbox = counts.get("pillbox", 0)
    mito = counts.get("mitochondrial", 0)
    flags, product_eur, ship_eur = [], 0.0, 0.0
    ful = o.get("fulfillments") or []

    if o.get("cancelledAt"):
        flags.append("STORNIERT - nicht zahlen")
    refunded = float(o["totalRefundedSet"]["shopMoney"]["amount"])
    if refunded > 0:
        flags.append(f"Rueckerstattung {refunded:.2f} EUR pruefen")

    if bottles:
        country = prices["countries"].get(cc)
        tiers = (country or {}).get("astaxanthin") or {}
        tier = tiers.get(str(bottles))
        if country is None:
            flags.append(f"Land {cc}: keine Preisliste")
        elif tier:
            product_eur += tier["product"]; ship_eur += tier["total"] - tier["product"]
        else:
            valid = sorted((int(k), v) for k, v in tiers.items() if v)
            if not valid:
                flags.append(f"Land {cc}: Preise fehlen")
            else:
                higher = [v for k, v in valid if k >= bottles]
                base = higher[0] if higher else valid[-1][1]
                per_piece = valid[0][1]["product"] / valid[0][0]
                product_eur += round(per_piece * bottles, 2)
                ship_eur += base["total"] - base["product"]
                flags.append(f"{bottles} Flaschen: keine Staffel, Versand geschaetzt")
    if pillbox:
        a = prices["addons"]["pillbox"]
        product_eur += a["product"] * pillbox; ship_eur += (a["total"] - a["product"]) * pillbox
    if mito:
        flags.append(f"{mito}x Mitochondrial: Preis fehlt")
    if unknown:
        flags.append("Unbekannt: " + ", ".join(unknown))
    revenue = float(o["totalPriceSet"]["shopMoney"]["amount"])
    if (bottles or pillbox) and revenue < 5:
        flags.append(f"Testbestellung? Umsatz nur {revenue:.2f} EUR")
    if ful and not any(t.get("number") for f in ful for t in (f.get("trackingInfo") or [])) and (bottles or pillbox):
        flags.append("versendet ohne Tracking")
    if not bottles and not pillbox and not mito and not unknown:
        flags.append("keine physische Ware")

    total_eur = 0.0 if o.get("cancelledAt") else round(product_eur + ship_eur, 2)
    tracking = ", ".join(t["number"] for f in ful for t in (f.get("trackingInfo") or []) if t.get("number"))
    return {
        "Bestellung": o["name"],
        "Bestelldatum": d(o["createdAt"]),
        "Versanddatum": d(ful[0]["createdAt"]) if ful else None,
        "Land": cc,
        "Kunde": (o.get("customer") or {}).get("displayName") or "",
        "Flaschen": bottles,
        "Pillendoos": pillbox,
        "Status": o["displayFulfillmentStatus"],
        "Zahlung": o["displayFinancialStatus"],
        "Umsatz EUR": float(o["totalPriceSet"]["shopMoney"]["amount"]),
        "Ware EUR": round(product_eur, 2),
        "Versand EUR": round(ship_eur, 2),
        "Kosten EUR": total_eur,
        "Tracking": tracking,
        "Hinweis": "; ".join(flags),
    }

# ---------------------------------------------------------------- Ausgabe
def fmt_table(rows, cols):
    widths = {c: max(len(c), *(len(str(r[c]) if r[c] is not None else "") for r in rows)) for c in cols}
    line = "  ".join(c.ljust(widths[c]) for c in cols)
    out = [line, "-" * len(line)]
    for r in rows:
        out.append("  ".join((str(r[c]) if r[c] is not None else "").ljust(widths[c]) for c in cols))
    return "\n".join(out)

def write_xlsx(path, rows, summary, prices, meta):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter
    wb = Workbook(); bold = Font(bold=True)
    head_fill = PatternFill("solid", fgColor="DDE5F0"); warn_fill = PatternFill("solid", fgColor="FFF2CC")

    ws = wb.active; ws.title = "Bestellungen"
    cols = list(rows[0].keys()) if rows else []
    ws.append(cols)
    for c in ws[1]: c.font = bold; c.fill = head_fill
    for r in rows:
        ws.append([r[c] for c in cols])
        if r["Hinweis"]:
            for c in ws[ws.max_row]: c.fill = warn_fill
    for i, c in enumerate(cols, 1):
        ws.column_dimensions[get_column_letter(i)].width = min(45, max(12, len(c) + 2))
    ws.column_dimensions[get_column_letter(cols.index("Kosten USD") + 1)].width = 12
    ws.freeze_panes = "A2"

    ws2 = wb.create_sheet("Zusammenfassung")
    for line in meta: ws2.append(line)
    ws2.append([])
    ws2.append(["Land", "Bestellungen", "Flaschen", "Pillendoos", "Ware EUR", "Versand EUR", "Kosten EUR", "Kosten USD"])
    for c in ws2[ws2.max_row]: c.font = bold; c.fill = head_fill
    for s in summary: ws2.append(s)
    for c in ws2[ws2.max_row]: c.font = bold
    ws2.column_dimensions["A"].width = 28
    for col in "BCDEFGH": ws2.column_dimensions[col].width = 14

    ws3 = wb.create_sheet("Preisliste")
    ws3.append(["Land", "Logistik", "Lieferzeit", "Staffel", "Ware EUR", "Versand EUR", "Gesamt EUR"])
    for c in ws3[1]: c.font = bold; c.fill = head_fill
    for cc, v in prices["countries"].items():
        for t, x in (v.get("astaxanthin") or {}).items():
            if x: ws3.append([cc, v.get("logistics"), v.get("delivery"), f"{t} Flasche(n)", x["product"], x["total"] - x["product"], x["total"]])
            else: ws3.append([cc, v.get("logistics"), v.get("delivery"), f"{t} Flasche(n)", None, None, "FEHLT"])
    a = prices["addons"]["pillbox"]
    ws3.append(["alle", "", "", "Pillendoos (je Stueck)", a["product"], a["total"] - a["product"], a["total"]])
    for col in "ABCDEFG": ws3.column_dimensions[col].width = 16
    wb.save(path)

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--from", dest="date_from", help="YYYY-MM-DD (inklusive)")
    ap.add_argument("--to", dest="date_to", help="YYYY-MM-DD (inklusive)")
    ap.add_argument("--basis", choices=["created", "fulfilled"], default="created",
                    help="Datum fuer den Zeitraum: Bestelldatum (created) oder Versanddatum (fulfilled)")
    ap.add_argument("--orders", help="Kommagetrennte Bestellnummern, z.B. '#213039,#212999'")
    ap.add_argument("--countries", help="Nur diese Laender, z.B. NL,BE")
    ap.add_argument("--input", nargs="*", help="Gespeicherte GraphQL-JSON-Dateien (Glob erlaubt)")
    ap.add_argument("--prices", default=os.path.join(HERE, "prices.json"))
    ap.add_argument("--rate", type=float, help="EUR pro 1 USD (sonst live)")
    ap.add_argument("--invoice", type=float, help="Rechnungsbetrag des Agenten zum Vergleich")
    ap.add_argument("--invoice-currency", choices=["EUR", "USD"], default="EUR")
    ap.add_argument("--xlsx", help="Excel-Datei schreiben")
    ap.add_argument("--all", action="store_true", help="Auch Zeilen ohne Ware/stornierte anzeigen")
    args = ap.parse_args()

    with open(args.prices) as fh: prices = json.load(fh)
    product_kind = {}
    for kind, p in prices["products"].items():
        for pid in p["product_ids"]: product_kind[pid] = kind
    for pid in prices["ignore_product_ids"]: product_kind[pid] = "ignore"

    date_from = date.fromisoformat(args.date_from) if args.date_from else None
    date_to = date.fromisoformat(args.date_to) if args.date_to else None
    wanted = {n.strip() if n.strip().startswith("#") else "#" + n.strip()
              for n in args.orders.split(",")} if args.orders else None

    if args.input:
        orders = load_files(args.input)
    else:
        q = []
        if date_from: q.append(f"created_at:>={date_from.isoformat()}")
        if date_to: q.append(f"created_at:<={date_to.isoformat()}T23:59:59Z")
        if args.basis == "fulfilled":  # grosszuegig laden, Filter unten
            q = [f"created_at:>={(date_from.replace(day=1)).isoformat()}"] if date_from else []
        orders = fetch_live(" AND ".join(q) if q else None)

    rate_eur_per_usd, rate_date, rate_src = (args.rate, "manuell", "manuell") if args.rate else fetch_rate()
    usd_per_eur = 1 / rate_eur_per_usd

    rows = []
    for o in orders:
        r = cost_for_order(o, prices, product_kind)
        key = r["Bestelldatum"] if args.basis == "created" else r["Versanddatum"]
        if wanted is not None and r["Bestellung"] not in wanted: continue
        if wanted is None:
            if key is None and args.basis == "fulfilled": continue
            if date_from and key < date_from: continue
            if date_to and key > date_to: continue
        if args.countries and r["Land"] not in args.countries.upper().split(","): continue
        if not args.all and r["Kosten EUR"] == 0 and not r["Hinweis"].startswith(("STORNIERT",)) and "fehlt" not in r["Hinweis"]:
            continue
        r["Kosten USD"] = round(r["Kosten EUR"] * usd_per_eur, 2)
        rows.append(r)
    rows.sort(key=lambda r: (r["Bestelldatum"], r["Bestellung"]))

    # Zusammenfassung je Land
    agg = defaultdict(lambda: [0, 0, 0, 0.0, 0.0, 0.0])
    for r in rows:
        a = agg[r["Land"]]; a[0] += 1; a[1] += r["Flaschen"]; a[2] += r["Pillendoos"]
        a[3] += r["Ware EUR"]; a[4] += r["Versand EUR"]; a[5] += r["Kosten EUR"]
    summary = [[cc, a[0], a[1], a[2], round(a[3], 2), round(a[4], 2), round(a[5], 2), round(a[5] * usd_per_eur, 2)]
               for cc, a in sorted(agg.items())]
    tot = [sum(s[i] for s in summary) for i in range(1, 7)]
    total_eur = round(tot[5], 2); total_usd = round(total_eur * usd_per_eur, 2)
    summary.append(["GESAMT", tot[0], tot[1], tot[2], round(tot[3], 2), round(tot[4], 2), total_eur, total_usd])

    period = f"{args.basis}: {date_from or '...'} bis {date_to or '...'}" if not wanted else f"{len(wanted)} Bestellnummern"
    meta = [["Agent-Check Eveom / YLFulfilment"],
            ["Zeitraum", period],
            ["Erstellt", datetime.now().strftime("%Y-%m-%d %H:%M")],
            ["Wechselkurs", f"1 USD = {rate_eur_per_usd:.4f} EUR  (1 EUR = {usd_per_eur:.4f} USD)", f"Stand {rate_date}", rate_src]]

    cols = ["Bestellung", "Bestelldatum", "Versanddatum", "Land", "Flaschen", "Pillendoos", "Kosten EUR", "Kosten USD", "Hinweis"]
    print(fmt_table(rows, cols) if rows else "Keine Bestellungen im Zeitraum.")
    print()
    print(fmt_table([dict(zip(["Land", "Bestellungen", "Flaschen", "Pillendoos", "Ware EUR", "Versand EUR", "Kosten EUR", "Kosten USD"], s)) for s in summary],
                    ["Land", "Bestellungen", "Flaschen", "Pillendoos", "Ware EUR", "Versand EUR", "Kosten EUR", "Kosten USD"]))
    print(f"\nWechselkurs: 1 USD = {rate_eur_per_usd:.4f} EUR (Stand {rate_date}, {rate_src})")
    print(f"ERWARTETE AGENTEN-RECHNUNG: {total_eur:,.2f} EUR  =  {total_usd:,.2f} USD")
    flagged = [r for r in rows if r["Hinweis"]]
    if flagged:
        print(f"{len(flagged)} Bestellung(en) mit Hinweis, bitte oben pruefen.")

    if args.invoice is not None:
        inv_eur = args.invoice if args.invoice_currency == "EUR" else args.invoice * rate_eur_per_usd
        diff = round(inv_eur - total_eur, 2)
        print(f"\nRechnung Agent: {args.invoice:,.2f} {args.invoice_currency} = {inv_eur:,.2f} EUR")
        if abs(diff) < 0.5:
            print("=> Rechnung stimmt mit der Berechnung ueberein.")
        elif diff > 0:
            print(f"=> ACHTUNG: Agent berechnet {diff:,.2f} EUR ({diff*usd_per_eur:,.2f} USD) ZU VIEL.")
        else:
            print(f"=> Agent berechnet {-diff:,.2f} EUR ({-diff*usd_per_eur:,.2f} USD) zu wenig.")
        meta.append(["Rechnung Agent", f"{args.invoice:,.2f} {args.invoice_currency}", f"Differenz {diff:+,.2f} EUR"])

    if args.xlsx:
        write_xlsx(args.xlsx, rows, summary, prices, meta)
        print(f"\nExcel geschrieben: {args.xlsx}")

if __name__ == "__main__":
    main()
