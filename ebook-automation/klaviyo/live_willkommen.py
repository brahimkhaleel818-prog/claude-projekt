# Willkommens-Mail 1 für den Livegang: eine Vorlage je Sprache, Gewinn per Profil-Eigenschaft
# "gluecks_preis" (10 / 15 / versand, ohne Wert = Standard 10 %).
#   python3 klaviyo/live_willkommen.py  → klaviyo/live/willkommen-1-<sprache>.html + betreff.json

import json
from pathlib import Path

import build

# Shopify vergibt die Codes ohne Ablaufdatum – daher keine „14 Tage gültig“-Aussage.
OHNE_FRIST = {
    "Er ist <b>14 Tage gültig</b> und einmal einlösbar.": "Er ist einmal einlösbar.",
    "De code is <b>14 dagen geldig</b> en eenmalig te gebruiken.": "De code is eenmalig te gebruiken.",
    "Il est <b>valable 14 jours</b> et utilisable une seule fois.": "Il est utilisable une seule fois.",
    "It is <b>valid for 14 days</b> and can be used once.": "It can be used once.",
}
build.HERO = f"{build.CDN}/2f33e870-f124-42ef-93a2-53aa874573a4.png?v=1792963515&width=1120&height=900&crop=center"
PREIS = "person|lookup:'gluecks_preis'"
OUT = Path(__file__).parent / "live"


def block(absaetze):
    html = "".join(p if p.startswith("<") else f"<p>{p}</p>" for p in absaetze)
    for alt, neu in OHNE_FRIST.items():
        html = html.replace(alt, neu)
    return html


def main():
    OUT.mkdir(exist_ok=True)
    betreffe = {}
    for lang in ("de", "nl", "fr", "en"):
        varianten = {p: build.gewinn_mail(p, lang) for p in ("15", "versand", "10")}
        standard = build.MAILS["willkommen-1-standard"][lang]
        inhalt = (
            f"<div>{{% if {PREIS} == '15' %}}{block(varianten['15']['absaetze'])}"
            f"{{% elif {PREIS} == 'versand' %}}{block(varianten['versand']['absaetze'])}"
            f"{{% elif {PREIS} == '10' %}}{block(varianten['10']['absaetze'])}"
            f"{{% else %}}{block(standard['absaetze'])}{{% endif %}}</div>"
        )
        build.MAILS["willkommen-live"] = {lang: dict(standard, absaetze=[inhalt])}
        (OUT / f"willkommen-1-{lang}.html").write_text(build.render("willkommen-live", lang))
        betreffe[lang] = dict(
            betreff=(f"{{% if {PREIS} == '15' %}}{varianten['15']['betreff']}"
                     f"{{% elif {PREIS} == 'versand' %}}{varianten['versand']['betreff']}"
                     f"{{% else %}}{varianten['10']['betreff']}{{% endif %}}"),
            vorschau=standard["vorschau"],
        )
    (OUT / "betreff.json").write_text(json.dumps(betreffe, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
