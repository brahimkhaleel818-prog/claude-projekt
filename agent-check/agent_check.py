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
        a = (prices.get("addons") or {}).get("pillbox")
        if a:
            product_eur += a["product"] * pillbox; ship_eur += (a["total"] - a["product"]) * pillbox
        else:
            flags.append(f"{pillbox}x Pillendoos: Preis fehlt")
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
        "Ware": round(product_eur, 2),
        "Versand": round(ship_eur, 2),
        "Kosten": total_eur,
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

def write_xlsx(path, rows, summary, prices, meta, cur="EUR"):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter
    wb = Workbook(); bold = Font(bold=True)
    head_fill = PatternFill("solid", fgColor="DDE5F0"); warn_fill = PatternFill("solid", fgColor="FFF2CC")

    ws = wb.active; ws.title = "Bestellungen"
    cols = list(rows[0].keys()) if rows else []
    ws.append([f"{c} {cur}" if c in ("Ware", "Versand", "Kosten") else c for c in cols])
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
    ws2.append(["Land", "Bestellungen", "Flaschen", "Pillendoos", f"Ware {cur}", f"Versand {cur}", "Kosten EUR", "Kosten USD"])
    for c in ws2[ws2.max_row]: c.font = bold; c.fill = head_fill
    for s in summary: ws2.append(s)
    for c in ws2[ws2.max_row]: c.font = bold
    ws2.column_dimensions["A"].width = 28
    for col in "BCDEFGH": ws2.column_dimensions[col].width = 14

    ws3 = wb.create_sheet("Preisliste")
    ws3.append(["Land", "Logistik", "Lieferzeit", "Staffel", f"Ware {cur}", f"Versand {cur}", f"Gesamt {cur}"])
    for c in ws3[1]: c.font = bold; c.fill = head_fill
    for cc, v in prices["countries"].items():
        for t, x in (v.get("astaxanthin") or {}).items():
            if x: ws3.append([cc, v.get("logistics"), v.get("delivery"), f"{t} Flasche(n)", x["product"], x["total"] - x["product"], x["total"]])
            else: ws3.append([cc, v.get("logistics"), v.get("delivery"), f"{t} Flasche(n)", None, None, "FEHLT"])
    a = (prices.get("addons") or {}).get("pillbox")
    if a: ws3.append(["alle", "", "", "Pillendoos (je Stueck)", a["product"], a["total"] - a["product"], a["total"]])
    else: ws3.append(["alle", "", "", "Pillendoos (je Stueck)", None, None, "FEHLT"])
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
    ap.add_argument("--from-order", help="Erste Bestellnummer, z.B. #211059")
    ap.add_argument("--to-order", help="Letzte Bestellnummer, z.B. #211809")
    ap.add_argument("--countries", help="Nur diese Laender, z.B. NL,BE")
    ap.add_argument("--input", nargs="*", help="Gespeicherte GraphQL-JSON-Dateien (Glob erlaubt)")
    ap.add_argument("--prices", default=os.path.join(HERE, "prices.json"))
    ap.add_argument("--rate", type=float, help="EUR pro 1 USD (sonst live)")
    ap.add_argument("--invoice", type=float, help="Rechnungsbetrag des Agenten zum Vergleich")
    ap.add_argument("--invoice-currency", choices=["EUR", "USD"], default="EUR")
    ap.add_argument("--xlsx", help="Excel-Datei schreiben")
    ap.add_argument("--all", action="store_true", help="Auch Zeilen ohne Ware/stornierte anzeigen")
    args = ap.parse_args()

    rate_eur_per_usd, rate_date, rate_src = (args.rate, "manuell", "manuell") if args.rate else fetch_rate()
    usd_per_eur = 1 / rate_eur_per_usd
    with open(args.prices) as fh: prices = json.load(fh)
    cur = prices.get("currency", "EUR").upper()
    to_eur = (lambda x: x) if cur == "EUR" else (lambda x: round(x * rate_eur_per_usd, 2))
    to_usd = (lambda x: round(x * usd_per_eur, 2)) if cur == "EUR" else (lambda x: x)
    product_kind = {}
    for kind, p in prices["products"].items():
        for pid in p["product_ids"]: product_kind[pid] = kind
    for pid in prices["ignore_product_ids"]: product_kind[pid] = "ignore"

    date_from = date.fromisoformat(args.date_from) if args.date_from else None
    date_to = date.fromisoformat(args.date_to) if args.date_to else None
    wanted = {n.strip() if n.strip().startswith("#") else "#" + n.strip()
              for n in args.orders.split(",")} if args.orders else None

    num = lambda name: int("".join(ch for ch in name if ch.isdigit()) or 0)
    o_from = num(args.from_order) if args.from_order else None
    o_to = num(args.to_order) if args.to_order else None
    if (o_from or o_to) and wanted is None and not date_from:
        date_from = date(2000, 1, 1)  # Zeitraumfilter aus, Nummernfilter an

    if args.input:
        orders = load_files(args.input)
    else:
        q = []
        if date_from: q.append(f"created_at:>={date_from.isoformat()}")
        if date_to: q.append(f"created_at:<={date_to.isoformat()}T23:59:59Z")
        if args.basis == "fulfilled":  # grosszuegig laden, Filter unten
            q = [f"created_at:>={(date_from.replace(day=1)).isoformat()}"] if date_from else []
        orders = fetch_live(" AND ".join(q) if q else None)

    rows = []
    for o in orders:
        r = cost_for_order(o, prices, product_kind)
        key = r["Bestelldatum"] if args.basis == "created" else r["Versanddatum"]
        if wanted is not None and r["Bestellung"] not in wanted: continue
        n = num(r["Bestellung"])
        if o_from and n < o_from: continue
        if o_to and n > o_to: continue
        if wanted is None:
            if key is None and args.basis == "fulfilled": continue
            if date_from and key < date_from: continue
            if date_to and key > date_to: continue
        if args.countries and r["Land"] not in args.countries.upper().split(","): continue
        if not args.all and r["Kosten"] == 0 and not r["Hinweis"].startswith(("STORNIERT",)) and "fehlt" not in r["Hinweis"]:
            continue
        if cur == "USD":
            r["Kosten USD"] = r["Kosten"]; r["Kosten EUR"] = round(r["Kosten"] * rate_eur_per_usd, 2)
        else:
            r["Kosten EUR"] = r["Kosten"]; r["Kosten USD"] = round(r["Kosten"] * usd_per_eur, 2)
        rows.append(r)
    rows.sort(key=lambda r: (r["Bestelldatum"], r["Bestellung"]))

    # Gruppen: Hauptgruppe = bezahlt; getrennt = nicht bezahlt
    def group(r):
        if r["Hinweis"].startswith("STORNIERT"): return "storniert"
        if r["Zahlung"] != "PAID" and r["Zahlung"] != "PARTIALLY_REFUNDED": return "NICHT BEZAHLT"
        return "bezahlt"
    for r in rows: r["Gruppe"] = group(r)
    main_rows = [r for r in rows if r["Gruppe"] == "bezahlt"]
    other = defaultdict(list)
    for r in rows:
        if r["Gruppe"] != "bezahlt": other[r["Gruppe"]].append(r)

    # Zusammenfassung je Land (nur bezahlte)
    agg = defaultdict(lambda: [0, 0, 0, 0.0, 0.0, 0.0])
    for r in main_rows:
        a = agg[r["Land"]]; a[0] += 1; a[1] += r["Flaschen"]; a[2] += r["Pillendoos"]
        a[3] += r["Ware"]; a[4] += r["Versand"]; a[5] += r["Kosten"]
    summary = [[cc, a[0], a[1], a[2], round(a[3], 2), round(a[4], 2), to_eur(round(a[5], 2)), to_usd(round(a[5], 2))]
               for cc, a in sorted(agg.items())]
    tot_native = round(sum(a[5] for a in agg.values()), 2)
    total_eur = to_eur(tot_native); total_usd = to_usd(tot_native)
    summary.append(["GESAMT", sum(a[0] for a in agg.values()), sum(a[1] for a in agg.values()), sum(a[2] for a in agg.values()),
                    round(sum(a[3] for a in agg.values()), 2), round(sum(a[4] for a in agg.values()), 2), total_eur, total_usd])

    if wanted: period = f"{len(wanted)} Bestellnummern"
    elif o_from or o_to: period = f"Bestellnummern {args.from_order or '...'} bis {args.to_order or '...'}"
    else: period = f"{args.basis}: {date_from or '...'} bis {date_to or '...'}"
    meta = [[f"Agent-Check Eveom / {prices.get('agent', '')} (Preise in {cur})"],
            ["Zeitraum", period],
            ["Erstellt", datetime.now().strftime("%Y-%m-%d %H:%M")],
            ["Wechselkurs", f"1 USD = {rate_eur_per_usd:.4f} EUR  (1 EUR = {usd_per_eur:.4f} USD)", f"Stand {rate_date}", rate_src]]

    cols = ["Bestellung", "Bestelldatum", "Versanddatum", "Land", "Flaschen", "Pillendoos", "Status", "Kosten EUR", "Kosten USD", "Hinweis"]
    print(f"=== BEZAHLTE BESTELLUNGEN ({len(main_rows)}) ===")
    print(fmt_table(main_rows, cols) if main_rows else "Keine Bestellungen im Zeitraum.")
    print()
    sum_cols = ["Land", "Bestellungen", "Flaschen", "Pillendoos", f"Ware {cur}", f"Versand {cur}", "Kosten EUR", "Kosten USD"]
    print(fmt_table([dict(zip(sum_cols, s)) for s in summary], sum_cols))
    print(f"\nWechselkurs: 1 USD = {rate_eur_per_usd:.4f} EUR (Stand {rate_date}, {rate_src})")
    print(f"ERWARTETE AGENTEN-RECHNUNG: {total_eur:,.2f} EUR  =  {total_usd:,.2f} USD")
    flagged = [r for r in rows if r["Hinweis"]]
    if flagged:
        print(f"{len(flagged)} Bestellung(en) mit Hinweis, bitte oben pruefen.")

    for g, rs in other.items():
        g_nat = round(sum(r["Kosten"] for r in rs), 2)
        print(f"\n=== {g.upper()} ({len(rs)}) - SEPARAT, NICHT IN DER SUMME OBEN ===")
        print(fmt_table(rs, cols))
        print(f"Summe {g}: {to_eur(g_nat):,.2f} EUR = {to_usd(g_nat):,.2f} USD")
        summary.append([f"separat: {g}", len(rs), sum(r["Flaschen"] for r in rs), sum(r["Pillendoos"] for r in rs),
                        round(sum(r["Ware"] for r in rs), 2), round(sum(r["Versand"] for r in rs), 2), to_eur(g_nat), to_usd(g_nat)])

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
        write_xlsx(args.xlsx, rows, summary, prices, meta, cur)
        print(f"\nExcel geschrieben: {args.xlsx}")

if __name__ == "__main__":
    main()
