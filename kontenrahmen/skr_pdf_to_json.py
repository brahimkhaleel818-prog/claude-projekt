import pdfplumber, re, sys, json
from collections import defaultdict, Counter

CONNECTORS = {"und", "oder", "bzw", "bzw.", "sowie", "bis", "u.", "o.", "ggf.", "sog.", "i.", "z."}

# Offizielle DATEV-Kontenklassen-Bezeichnungen (stabil, durch PDF-Kopf bestaetigt)
KLASSEN = {
    "SKR03": {
        "0": "Anlage- und Kapitalkonten",
        "1": "Finanz- und Privatkonten",
        "2": "Abgrenzungskonten",
        "3": "Wareneingangs- und Bestandskonten",
        "4": "Betriebliche Aufwendungen",
        "5": "Frei / weitere Aufwandskonten",
        "6": "Frei / weitere Aufwandskonten",
        "7": "Bestände an Erzeugnissen",
        "8": "Erlöskonten",
        "9": "Vortrags-, Kapital-, Korrektur- und statistische Konten",
    },
    "SKR04": {
        "0": "Anlagevermögenskonten",
        "1": "Umlaufvermögenskonten",
        "2": "Eigenkapitalkonten",
        "3": "Fremdkapitalkonten",
        "4": "Betriebliche Erträge",
        "5": "Betriebliche Aufwendungen",
        "6": "Betriebliche Aufwendungen",
        "7": "Weitere Erträge und Aufwendungen",
        "8": "Frei / statistische Konten",
        "9": "Vortrags-, Kapital-, Korrektur- und statistische Konten",
    },
}
# Typ je Kontenklasse (abgeleitet). "gemischt" = Klasse enthaelt Aktiv- und Passivkonten.
TYP = {
    "SKR03": {"0": "gemischt", "1": "gemischt", "2": "gemischt", "3": "Aufwand",
              "4": "Aufwand", "5": "Aufwand", "6": "Aufwand", "7": "Aktiv",
              "8": "Ertrag", "9": "Statistisch"},
    "SKR04": {"0": "Aktiv", "1": "Aktiv", "2": "Passiv", "3": "Passiv",
              "4": "Ertrag", "5": "Aufwand", "6": "Aufwand", "7": "gemischt",
              "8": "Statistisch", "9": "Statistisch"},
}

def is_bold(c):
    return "Bold" in (c.get("fontname") or "")

def join_hyphen(segments):
    segs = [s.strip() for s in segments if s and s.strip()]
    if not segs:
        return ""
    res = segs[0]
    for seg in segs[1:]:
        if res.endswith("-"):
            fw = seg.split()[0].rstrip(".,;:").lower()
            res = res + " " + seg if fw in CONNECTORS else res[:-1] + seg
        else:
            res += " " + seg
    return re.sub(r"\s+", " ", res).strip()

def number_start_x(chars):
    """x0-Startpositionen aller 4-stelligen Zahlen-Läufe."""
    starts = []
    lines = defaultdict(list)
    for c in chars:
        lines[round(c["top"])].append(c)
    for top, cs in lines.items():
        cs = sorted(cs, key=lambda c: c["x0"])
        for j, c in enumerate(cs):
            if c["text"].isdigit() and (j == 0 or not cs[j-1]["text"].isdigit()):
                run = k = 0
                k = j
                while k < len(cs) and cs[k]["text"].isdigit():
                    run += 1; k += 1
                if run == 4:
                    starts.append(c["x0"])
    return starts

def find_columns(chars):
    """Ermittelt die beiden Kontonummern-Spalten (links/rechts) und den
    dynamischen Hälften-Schnitt. Gibt (halves, split) zurück."""
    starts = number_start_x(chars)
    if not starts:
        return None
    cnt = Counter(round(s / 2) * 2 for s in starts)
    main = cnt.most_common(1)[0][0]
    # zweite Spalte: häufigste Position mit Abstand > 80 zur ersten
    second = None
    for x, _ in cnt.most_common():
        if abs(x - main) > 80:
            second = x; break
    if second is None:
        return ([(main,)], 612)  # nur eine Spalte
    left, right = sorted([main, second])
    left_margin = min(c["x0"] for c in chars)
    right_bp = left_margin + (right - left)        # rechte Bilanz-Posten-Spalte
    split = right_bp - 6
    return ([(left, 0, split), (right, split, 612)], split)

def parse_page(p, category_state):
    chars = [c for c in p.chars if 118 < c["top"] < 745]
    cols = find_columns(chars)
    if cols is None:
        return []
    halves, _ = cols
    accounts = []
    for spec in halves:
        if len(spec) == 1:
            center, xlo, xhi = spec[0], 0, 612
        else:
            center, xlo, xhi = spec
        hc = [c for c in chars if xlo <= c["x0"] < xhi]
        numlo, numhi = center - 6, center + 6
        bezmin = center + 14
        lines = defaultdict(list)
        for c in hc:
            lines[round(c["top"])].append(c)
        cur = None
        in_header = False
        for top in sorted(lines):
            cs = sorted(lines[top], key=lambda c: c["x0"])
            num = None
            bez_start = bezmin
            for j, c in enumerate(cs):
                if numlo <= c["x0"] <= numhi and c["text"].isdigit():
                    # nicht Teil einer Range/Zahl (z.B. "-6999", "12345")
                    if j > 0 and cs[j-1]["text"] in "0123456789-":
                        continue
                    digs = []
                    k = j
                    while k < len(cs) and cs[k]["text"].isdigit() and len(digs) < 4:
                        digs.append(cs[k]); k += 1
                    # nächstes Zeichen darf keine weitere Ziffer sein (5-stellig = keine Kontonr.)
                    if k < len(cs) and cs[k]["text"].isdigit():
                        continue
                    if len(digs) == 4:
                        num = "".join(d["text"] for d in digs)
                        bez_start = digs[-1]["x1"] + 1
                        break
            band = sorted([c for c in cs if c["x0"] > bez_start], key=lambda c: c["x0"])
            full_txt = "".join(c["text"] for c in band).strip()
            has_bold = any(is_bold(c) for c in band)
            has_reg = any((not is_bold(c)) for c in band)
            fw = full_txt.split()[0] if full_txt.split() else ""
            if num:
                if cur:
                    accounts.append(cur)
                cur = {"nummer": num, "segs": [full_txt], "kategorie": category_state[0]}
                in_header = False
            elif not full_txt:
                continue
            elif has_reg and not has_bold:
                in_header = False
                if cur is not None:
                    cur["segs"].append(full_txt)     # reine Fließschrift -> Fortsetzung
            elif in_header:
                # Fortsetzung einer umgebrochenen Überschrift bleibt Überschrift
                cont = category_state[0].endswith("-") or fw[:1].islower() or fw[:1] in "-,.)"
                category_state[0] = (category_state[0] + " " + full_txt) if cont else full_txt
            else:
                # fette Zeile ohne Nummer: Überschrift oder Konto-Fortsetzung?
                prev = cur["segs"][-1] if (cur and cur["segs"]) else ""
                is_cont = prev.endswith("-") or fw[:1].islower() or fw[:1] in "-,.)"
                if is_cont and cur is not None:
                    cur["segs"].append(full_txt)
                else:
                    category_state[0] = full_txt
                    in_header = True
        if cur:
            accounts.append(cur)
    return accounts

def strip_footnotes(s):
    """Entfernt hochgestellte Fußnoten-Marker (z.B. '17)') außerhalb von Klammern,
    erhält aber Klammer-Inhalte wie '(Postbank 1)'."""
    out = []
    depth = 0
    i, n = 0, len(s)
    while i < n:
        ch = s[i]
        if ch == "(":
            depth += 1; out.append(ch); i += 1; continue
        if ch == ")":
            depth = max(0, depth - 1); out.append(ch); i += 1; continue
        if depth == 0 and ch.isdigit():
            j = i
            while j < n and s[j].isdigit():
                j += 1
            if j < n and s[j] == ")" and (j - i) <= 2:
                while out and out[-1] == " ":
                    out.pop()
                out.append(" ")
                i = j + 1; continue
        out.append(ch); i += 1
    return re.sub(r"\s+", " ", "".join(out)).strip()

def is_real(bez):
    """Echtes Konto: enthält ein Wort mit >=3 Buchstaben und ist kein Legenden-Marker."""
    b = bez.strip()
    if not b or b.startswith("="):
        return False
    if re.fullmatch(r"=?\s*(Kreditoren|Debitoren)", b):   # Personenkonten-Legende
        return False
    if re.search(r"\bKU\b", b):                            # Programmverbindungs-Leak
        return False
    return bool(re.search(r"[A-Za-zÄÖÜäöüß]{3,}", b))

def parse_pdf(fn, rahmen):
    pdf = pdfplumber.open(fn)
    category_state = [""]
    rows = []
    for p in pdf.pages:
        page_rows = []
        for r in parse_page(p, category_state):
            bez = strip_footnotes(join_hyphen(r["segs"]))
            # angehängte Personenkonten-Legende ("= Debitoren = Kreditoren") entfernen
            bez = re.sub(r"\s*=?\s*Debitoren\s*=?\s*Kreditoren\s*$", "", bez).strip()
            if is_real(bez):
                r["bez"] = bez
                page_rows.append(r)
        # Legenden-/Fußnotenseiten haben sehr wenige echte Kontozeilen -> ueberspringen
        if len(page_rows) < 6:
            continue
        rows.extend(page_rows)
    # dedupe (erste echte Vorkommen behalten), dann nach Nummer sortieren
    seen = {}
    result = []
    for a in rows:
        num = a["nummer"]
        if num in seen:
            continue
        seen[num] = True
        kl = num[0]
        result.append({
            "nummer": num,
            "bezeichnung": a["bez"],
            "kontenklasse": kl,
            "kontenklasse_bezeichnung": KLASSEN[rahmen][kl],
            "kontengruppe": num[:2],
            "kategorie": strip_footnotes(a.get("kategorie", "")),
            "typ": TYP[rahmen][kl],
        })
    result.sort(key=lambda a: a["nummer"])
    return result

META = {
    "SKR03": {
        "bezeichnung": "DATEV-Standardkontenrahmen SKR03 (Prozessgliederungsprinzip)",
        "art_nr": "11174",
    },
    "SKR04": {
        "bezeichnung": "DATEV-Standardkontenrahmen SKR04 (Abschlussgliederungsprinzip)",
        "art_nr": "11175",
    },
}

def build(fn, rahmen):
    accts = parse_pdf(fn, rahmen)
    return {
        "kontenrahmen": rahmen,
        "bezeichnung": META[rahmen]["bezeichnung"],
        "version": "2026",
        "stand": "2026-01-01",
        "quelle": f"DATEV eG, Art.-Nr. {META[rahmen]['art_nr']}",
        "hinweis": ("Automatisch aus dem offiziellen DATEV-PDF extrahiert. 'nummer' und "
                    "'bezeichnung' stammen direkt aus dem PDF. 'kontenklasse_bezeichnung' und "
                    "'typ' sind aus der Kontenklasse abgeleitet (bei SKR03 enthalten einige "
                    "Klassen Aktiv- und Passivkonten -> 'gemischt'). 'kategorie' ist die "
                    "zugehörige Bilanz-/Gliederungsposten-Überschrift (näherungsweise). Für die "
                    "konkrete Buchungslogik bitte verifizieren."),
        "anzahl_konten": len(accts),
        "kontenklassen": KLASSEN[rahmen],
        "typ_je_kontenklasse": TYP[rahmen],
        "konten": accts,
    }

if __name__ == "__main__":
    fn, rahmen = sys.argv[1], sys.argv[2]
    data = build(fn, rahmen)
    out = sys.argv[3] if len(sys.argv) > 3 else None
    if out:
        with open(out, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("geschrieben:", out)
    accts = data["konten"]
    print(f"{rahmen}: {len(accts)} Konten")
    print("pro Klasse:", dict(sorted(Counter(a["kontenklasse"] for a in accts).items())))
    print("erste:", accts[0]["nummer"], accts[0]["bezeichnung"])
    print("letzte:", accts[-1]["nummer"], accts[-1]["bezeichnung"])
