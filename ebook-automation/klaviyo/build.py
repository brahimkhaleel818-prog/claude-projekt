# Erzeugt die Klaviyo-Mails (HTML) für Willkommens-Serie, abgebrochenen Checkout
# und Nachkauf-Erinnerung in DE/NL/FR/EN – im gleichen Design wie die E-Book-Mail.
#
#   python3 klaviyo/build.py          → klaviyo/mails.json + klaviyo/vorschau.html
#
# Platzhalter sind Klaviyo-Template-Tags ({{ person.first_name }}, {% coupon_code %} …).

import html
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
# Code-Vorlagen in Klaviyo (Shopify-Codes, je Kunde eindeutig, 14 Tage gültig) – je Gewinn im Glücks-Pop-up
COUPONS = {"standard": "WILLKOMMEN10", "10": "WILLKOMMEN10", "15": "WILLKOMMEN15", "versand": "GRATISVERSAND"}
SHOP = "https://www.eveom.health"
PRODUCT = {
    "de": f"{SHOP}/products/eveom-astaxanthin-de",
    "nl": f"{SHOP}/products/eveom-astaxanthine",
    "fr": f"{SHOP}/products/eveom-astaxanthine-fr",
    "en": f"{SHOP}/products/eveom-astaxanthine-us",
}
CDN = "https://cdn.shopify.com/s/files/1/0814/9155/8732/files"
HERO = f"{CDN}/eveom-galerij-6.jpg?width=1120&height=760&crop=bottom"
ALGE = f"{CDN}/eveom-galerij-3.jpg?crop=region&crop_left=735&crop_top=690&crop_width=360&crop_height=340&width=360"
KAPSEL = f"{CDN}/eveom-galerij-3.jpg?crop=region&crop_left=170&crop_top=690&crop_width=370&crop_height=340&width=370"
# Zwei Bilder nebeneinander für die Astaxanthin-Info-Mail
DUO = (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr>'
    f'<td width="50%" style="padding-right:6px;"><img src="{ALGE}" width="242" alt="" style="display:block;width:100%;height:auto;border-radius:8px;"></td>'
    f'<td width="50%" style="padding-left:6px;"><img src="{KAPSEL}" width="242" alt="" style="display:block;width:100%;height:auto;border-radius:8px;"></td>'
    "</tr></table>"
)
CHECKOUT = "{{ event.extra.checkout_url|default:'" + SHOP + "/cart' }}"
NAME = "{% if person.first_name %} {{ person.first_name }}{% endif %}"
ITEMS = (
    '{% for item in event.extra.line_items %}'
    '<tr><td style="padding:8px 0;border-bottom:1px solid #e6e0d8;">'
    '{{ item.product.title }} × {{ item.quantity|floatformat:0 }}</td></tr>'
    '{% endfor %}'
)
CODE_BOX = (
    '<p style="margin:24px 0;padding:18px;background:#f4f1ec;border-radius:8px;text-align:center;">'
    '<span style="font-size:14px;">{label}</span><br>'
    '<span style="font-size:24px;font-weight:bold;letter-spacing:2px;color:#7D000D;">'
    "{% coupon_code '{coupon}' %}</span></p>"
)
ITEMS_BOX = (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
    'style="margin:20px 0;font-size:15px;">' + ITEMS + "</table>"
)

L = {
    "de": dict(
        hallo="Hallo" + NAME + ",",
        gruss="Herzliche Grüße,",
        absenderin="Lena Hoffmann",
        abmelden="Abmelden",
        impressum="Impressum",
        grund_liste="Sie erhalten diese E-Mail, weil Sie sich für den Eveom-Newsletter angemeldet haben.",
        grund_kauf="Sie erhalten diese E-Mail, weil Sie dem Erhalt von E-Mails von Eveom zugestimmt haben.",
    ),
    "nl": dict(
        hallo="Beste" + NAME.replace("{% endif %}", "{% else %} klant{% endif %}") + ",",
        gruss="Met vriendelijke groet,",
        absenderin="Lotte de Vries",
        abmelden="Afmelden",
        impressum="Juridische informatie",
        grund_liste="U ontvangt deze e-mail omdat u zich heeft aangemeld voor de nieuwsbrief van Eveom.",
        grund_kauf="U ontvangt deze e-mail omdat u heeft ingestemd met het ontvangen van e-mails van Eveom.",
    ),
    "fr": dict(
        hallo="Bonjour" + NAME + ",",
        gruss="Bien cordialement,",
        absenderin="Chloé Martin",
        abmelden="Se désinscrire",
        impressum="Mentions légales",
        grund_liste="Vous recevez cet e-mail car vous vous êtes inscrit(e) à la newsletter Eveom.",
        grund_kauf="Vous recevez cet e-mail car vous avez accepté de recevoir des e-mails d’Eveom.",
    ),
    "en": dict(
        hallo="Hi" + NAME + ",",
        gruss="Warm regards,",
        absenderin="Emily Carter",
        abmelden="Unsubscribe",
        impressum="Legal notice",
        grund_liste="You are receiving this email because you signed up for the Eveom newsletter.",
        grund_kauf="You are receiving this email because you agreed to receive emails from Eveom.",
    ),
}

# Jede Mail: betreff, vorschau (Preheader), absaetze (HTML erlaubt), button (Text, Link), grund
MAILS = {
    # Ohne Gewinn (z. B. Anmeldung über die Kasse oder den Footer)
    "willkommen-1-standard": {
        "de": dict(
            betreff="Willkommen bei Eveom – hier ist Ihr 10 %-Code 🎁",
            vorschau="Ihr persönlicher Code für Ihre erste Bestellung",
            absaetze=[
                "schön, dass Sie da sind! Als Dankeschön für Ihre Anmeldung schenken wir Ihnen <b>10 % Rabatt auf Ihre erste Bestellung</b>.",
                CODE_BOX.replace("{coupon}", COUPONS["standard"]).replace("{label}", "Ihr persönlicher Code"),
                "Geben Sie den Code einfach beim Bezahlen ein. Er ist <b>14 Tage gültig</b> und einmal einlösbar.",
                "Ab 69,90 € Bestellwert ist der Versand außerdem kostenlos.",
            ],
            button=("Jetzt entdecken", PRODUCT["de"]),
        ),
        "nl": dict(
            betreff="Welkom bij Eveom – hier is uw kortingscode van 10% 🎁",
            vorschau="Uw persoonlijke code voor uw eerste bestelling",
            absaetze=[
                "fijn dat u er bent! Als bedankje voor uw aanmelding krijgt u <b>10% korting op uw eerste bestelling</b>.",
                CODE_BOX.replace("{coupon}", COUPONS["standard"]).replace("{label}", "Uw persoonlijke code"),
                "Vul de code gewoon in bij het afrekenen. De code is <b>14 dagen geldig</b> en eenmalig te gebruiken.",
                "Vanaf € 69,90 is de verzending bovendien gratis.",
            ],
            button=("Nu ontdekken", PRODUCT["nl"]),
        ),
        "fr": dict(
            betreff="Bienvenue chez Eveom – voici votre code de 10 % 🎁",
            vorschau="Votre code personnel pour votre première commande",
            absaetze=[
                "nous sommes ravis de vous compter parmi nous ! Pour vous remercier de votre inscription, nous vous offrons <b>10 % de réduction sur votre première commande</b>.",
                CODE_BOX.replace("{coupon}", COUPONS["standard"]).replace("{label}", "Votre code personnel"),
                "Il vous suffit de saisir ce code lors du paiement. Il est <b>valable 14 jours</b> et utilisable une seule fois.",
                "La livraison est offerte dès 69,90 € d’achat.",
            ],
            button=("Découvrir maintenant", PRODUCT["fr"]),
        ),
        "en": dict(
            betreff="Welcome to Eveom – here’s your 10% code 🎁",
            vorschau="Your personal code for your first order",
            absaetze=[
                "great to have you here! As a thank-you for signing up, enjoy <b>10% off your first order</b>.",
                CODE_BOX.replace("{coupon}", COUPONS["standard"]).replace("{label}", "Your personal code"),
                "Simply enter the code at checkout. It is <b>valid for 14 days</b> and can be used once.",
                "Shipping is free on orders from €69.90.",
            ],
            button=("Discover now", PRODUCT["en"]),
        ),
    },
    "willkommen-2": {
        "de": dict(
            betreff="Was ist eigentlich Astaxanthin?",
            vorschau="Ein kurzer Blick auf den roten Farbstoff aus der Natur",
            absaetze=[
                "vielleicht fragen Sie sich, was hinter Astaxanthin steckt. Hier das Wichtigste in Kürze:",
                "Astaxanthin ist ein natürlicher roter Farbstoff aus der Gruppe der Carotinoide. Er sorgt zum Beispiel für die rosa Farbe von Lachs und Flamingos. In der Natur stammt er vor allem aus Mikroalgen.",
                DUO,
                "<b>Unser Tipp:</b> Astaxanthin ist fettlöslich und wird deshalb gern zu einer Mahlzeit eingenommen. Bitte beachten Sie die Verzehrempfehlung auf der Verpackung.",
                "Ihr persönlicher Code aus unserer Willkommens-Mail ist übrigens noch 12 Tage gültig.",
            ],
            button=("Zu Eveom Astaxanthin", PRODUCT["de"]),
        ),
        "nl": dict(
            betreff="Wat is astaxanthine eigenlijk?",
            vorschau="Een korte blik op de rode kleurstof uit de natuur",
            absaetze=[
                "misschien vraagt u zich af wat astaxanthine precies is. Hier het belangrijkste op een rij:",
                "Astaxanthine is een natuurlijke rode kleurstof uit de groep van de carotenoïden. Het geeft bijvoorbeeld zalm en flamingo’s hun roze kleur. In de natuur komt het vooral uit microalgen.",
                DUO,
                "<b>Onze tip:</b> astaxanthine is vetoplosbaar en wordt daarom vaak bij een maaltijd ingenomen. Volg de gebruiksaanwijzing op de verpakking.",
                "Uw persoonlijke code uit onze welkomstmail is trouwens nog 12 dagen geldig.",
            ],
            button=("Naar Eveom Astaxanthine", PRODUCT["nl"]),
        ),
        "fr": dict(
            betreff="Qu’est-ce que l’astaxanthine, au juste ?",
            vorschau="Un petit tour d’horizon de ce pigment rouge naturel",
            absaetze=[
                "vous vous demandez peut-être ce qu’est l’astaxanthine. Voici l’essentiel en bref :",
                "L’astaxanthine est un pigment rouge naturel de la famille des caroténoïdes. C’est par exemple elle qui donne au saumon et aux flamants roses leur couleur. Dans la nature, elle provient surtout de micro-algues.",
                DUO,
                "<b>Notre conseil :</b> l’astaxanthine est liposoluble, c’est pourquoi on la prend volontiers au cours d’un repas. Veuillez respecter la dose journalière indiquée sur l’emballage.",
                "Votre code personnel reçu dans notre e-mail de bienvenue est d’ailleurs encore valable 12 jours.",
            ],
            button=("Découvrir Eveom Astaxanthine", PRODUCT["fr"]),
        ),
        "en": dict(
            betreff="What exactly is astaxanthin?",
            vorschau="A quick look at nature’s red pigment",
            absaetze=[
                "you may be wondering what astaxanthin actually is. Here are the key facts:",
                "Astaxanthin is a natural red pigment from the carotenoid family. It is what gives salmon and flamingos their pink colour. In nature, it comes mainly from microalgae.",
                DUO,
                "<b>Our tip:</b> astaxanthin is fat-soluble, which is why many people take it with a meal. Please follow the directions on the package.",
                "By the way, the personal code from our welcome email is still valid for 12 more days.",
            ],
            button=("Discover Eveom Astaxanthin", PRODUCT["en"]),
        ),
    },
    "willkommen-3": {
        "de": dict(
            betreff="Ihr persönlicher Code läuft in 3 Tagen ab ⏳",
            vorschau="Jetzt noch Ihren Vorteil für die erste Bestellung sichern",
            absaetze=[
                "nur noch 3 Tage: Dann läuft <b>Ihr persönlicher Code für Ihre erste Bestellung</b> ab.",
                "Sie finden den Code in unserer E-Mail „Willkommen bei Eveom“. Einfach beim Bezahlen eingeben – ab 69,90 € ist der Versand kostenlos.",
                "Haben Sie Fragen? Antworten Sie einfach auf diese E-Mail, wir helfen Ihnen gern.",
            ],
            button=("Code jetzt einlösen", PRODUCT["de"]),
        ),
        "nl": dict(
            betreff="Uw persoonlijke code verloopt over 3 dagen ⏳",
            vorschau="Profiteer nu nog van uw voordeel op uw eerste bestelling",
            absaetze=[
                "nog maar 3 dagen: dan verloopt <b>uw persoonlijke code voor uw eerste bestelling</b>.",
                "U vindt de code in onze e-mail „Welkom bij Eveom“. Vul hem gewoon in bij het afrekenen – vanaf € 69,90 is de verzending gratis.",
                "Heeft u vragen? Beantwoord gerust deze e-mail, we helpen u graag.",
            ],
            button=("Code nu gebruiken", PRODUCT["nl"]),
        ),
        "fr": dict(
            betreff="Votre code personnel expire dans 3 jours ⏳",
            vorschau="Profitez encore de votre avantage sur votre première commande",
            absaetze=[
                "plus que 3 jours : ensuite, <b>votre code personnel pour votre première commande</b> expire.",
                "Vous trouverez le code dans notre e-mail « Bienvenue chez Eveom ». Saisissez-le simplement lors du paiement – la livraison est offerte dès 69,90 €.",
                "Une question ? Répondez simplement à cet e-mail, nous vous aiderons avec plaisir.",
            ],
            button=("Utiliser mon code", PRODUCT["fr"]),
        ),
        "en": dict(
            betreff="Your personal code expires in 3 days ⏳",
            vorschau="Still time to use your perk on your first order",
            absaetze=[
                "only 3 days left: then <b>your personal code for your first order</b> expires.",
                "You’ll find the code in our email “Welcome to Eveom”. Just enter it at checkout – shipping is free on orders from €69.90.",
                "Any questions? Simply reply to this email, we’re happy to help.",
            ],
            button=("Use my code now", PRODUCT["en"]),
        ),
    },
    "checkout-1": {
        "de": dict(
            betreff="Haben Sie etwas vergessen?",
            vorschau="Ihr Warenkorb ist noch für Sie gespeichert",
            absaetze=[
                "Ihre Bestellung ist noch nicht abgeschlossen. Wir haben Ihren Warenkorb für Sie gespeichert:",
                ITEMS_BOX,
            ],
            button=("Bestellung abschließen", CHECKOUT),
        ),
        "nl": dict(
            betreff="Bent u iets vergeten?",
            vorschau="Uw winkelwagen staat nog voor u klaar",
            absaetze=[
                "uw bestelling is nog niet afgerond. We hebben uw winkelwagen voor u bewaard:",
                ITEMS_BOX,
            ],
            button=("Bestelling afronden", CHECKOUT),
        ),
        "fr": dict(
            betreff="Vous avez oublié quelque chose ?",
            vorschau="Votre panier vous attend",
            absaetze=[
                "votre commande n’est pas encore finalisée. Nous avons gardé votre panier pour vous :",
                ITEMS_BOX,
            ],
            button=("Finaliser ma commande", CHECKOUT),
        ),
        "en": dict(
            betreff="Did you forget something?",
            vorschau="Your cart is saved for you",
            absaetze=[
                "your order isn’t complete yet. We’ve saved your cart for you:",
                ITEMS_BOX,
            ],
            button=("Complete my order", CHECKOUT),
        ),
    },
    "checkout-2": {
        "de": dict(
            betreff="Ihr Warenkorb wartet noch auf Sie",
            vorschau="Falls noch Fragen offen sind – wir helfen gern",
            absaetze=[
                "falls noch Fragen offen sind, hier das Wichtigste auf einen Blick:",
                "✓ Kostenloser Versand ab 69,90 €<br>✓ Sichere Zahlung<br>✓ Persönlicher Service: Antworten Sie einfach auf diese E-Mail",
                ITEMS_BOX,
            ],
            button=("Zurück zum Warenkorb", CHECKOUT),
        ),
        "nl": dict(
            betreff="Uw winkelwagen wacht nog op u",
            vorschau="Nog vragen? We helpen u graag",
            absaetze=[
                "heeft u nog vragen? Hier het belangrijkste op een rij:",
                "✓ Gratis verzending vanaf € 69,90<br>✓ Veilig betalen<br>✓ Persoonlijke service: beantwoord gewoon deze e-mail",
                ITEMS_BOX,
            ],
            button=("Terug naar winkelwagen", CHECKOUT),
        ),
        "fr": dict(
            betreff="Votre panier vous attend toujours",
            vorschau="Une question ? Nous sommes là pour vous aider",
            absaetze=[
                "si vous avez encore des questions, voici l’essentiel en un coup d’œil :",
                "✓ Livraison offerte dès 69,90 €<br>✓ Paiement sécurisé<br>✓ Service personnalisé : répondez simplement à cet e-mail",
                ITEMS_BOX,
            ],
            button=("Retour au panier", CHECKOUT),
        ),
        "en": dict(
            betreff="Your cart is still waiting for you",
            vorschau="Any questions? We’re happy to help",
            absaetze=[
                "if you still have questions, here’s what matters most:",
                "✓ Free shipping on orders from €69.90<br>✓ Secure payment<br>✓ Personal service: simply reply to this email",
                ITEMS_BOX,
            ],
            button=("Back to my cart", CHECKOUT),
        ),
    },
    "checkout-3": {
        "de": dict(
            betreff="Letzte Erinnerung: Ihr Warenkorb",
            vorschau="Ihre Bestellung ist nur einen Klick entfernt",
            absaetze=[
                "dies ist unsere letzte Erinnerung an Ihren Warenkorb. Wenn Sie Ihre Bestellung noch abschließen möchten, geht das hier mit einem Klick.",
                ITEMS_BOX,
            ],
            button=("Jetzt bestellen", CHECKOUT),
        ),
        "nl": dict(
            betreff="Laatste herinnering: uw winkelwagen",
            vorschau="Uw bestelling is nog maar één klik verwijderd",
            absaetze=[
                "dit is onze laatste herinnering aan uw winkelwagen. Wilt u uw bestelling alsnog afronden? Dat kan hier met één klik.",
                ITEMS_BOX,
            ],
            button=("Nu bestellen", CHECKOUT),
        ),
        "fr": dict(
            betreff="Dernier rappel : votre panier",
            vorschau="Votre commande n’est qu’à un clic",
            absaetze=[
                "ceci est notre dernier rappel concernant votre panier. Si vous souhaitez encore finaliser votre commande, c’est possible ici en un clic.",
                ITEMS_BOX,
            ],
            button=("Commander maintenant", CHECKOUT),
        ),
        "en": dict(
            betreff="Last reminder: your cart",
            vorschau="Your order is just one click away",
            absaetze=[
                "this is our last reminder about your cart. If you’d still like to complete your order, you can do it here with one click.",
                ITEMS_BOX,
            ],
            button=("Order now", CHECKOUT),
        ),
    },
    "nachkauf-1": {
        "de": dict(
            betreff="Ihr Vorrat geht bald zur Neige",
            vorschau="Jetzt rechtzeitig nachbestellen",
            absaetze=[
                "Ihre Eveom-Bestellung ist jetzt fast einen Monat her – Ihr Vorrat dürfte also bald aufgebraucht sein.",
                "Damit keine Lücke entsteht, können Sie jetzt ganz einfach nachbestellen.",
                "💡 <b>Tipp:</b> Ab 69,90 € Bestellwert ist der Versand kostenlos – zum Beispiel mit zwei Dosen.",
            ],
            button=("Jetzt nachbestellen", PRODUCT["de"]),
        ),
        "nl": dict(
            betreff="Uw voorraad raakt bijna op",
            vorschau="Bestel nu op tijd bij",
            absaetze=[
                "uw Eveom-bestelling is nu bijna een maand geleden – uw voorraad is dus waarschijnlijk bijna op.",
                "Zo zit u niet zonder: u kunt nu heel eenvoudig opnieuw bestellen.",
                "💡 <b>Tip:</b> vanaf € 69,90 is de verzending gratis – bijvoorbeeld met twee potjes.",
            ],
            button=("Nu opnieuw bestellen", PRODUCT["nl"]),
        ),
        "fr": dict(
            betreff="Votre réserve touche bientôt à sa fin",
            vorschau="Recommandez dès maintenant",
            absaetze=[
                "votre commande Eveom date maintenant de presque un mois – votre réserve devrait donc bientôt être épuisée.",
                "Pour ne pas être à court, vous pouvez recommander très simplement dès maintenant.",
                "💡 <b>Astuce :</b> la livraison est offerte dès 69,90 € d’achat – par exemple avec deux flacons.",
            ],
            button=("Recommander maintenant", PRODUCT["fr"]),
        ),
        "en": dict(
            betreff="Your supply is running low",
            vorschau="Reorder now so you don’t run out",
            absaetze=[
                "it’s been almost a month since your Eveom order – so your supply is probably running low.",
                "To make sure you don’t run out, you can easily reorder now.",
                "💡 <b>Tip:</b> shipping is free on orders from €69.90 – for example with two bottles.",
            ],
            button=("Reorder now", PRODUCT["en"]),
        ),
    },
}

# Willkommens-Mail 1 je Gewinn aus dem Glücks-Pop-up (Profil-Eigenschaft "gluecks_preis")
GEWINN = {
    "de": dict(
        intro="herzlichen Glückwunsch zu Ihrem Gewinn – und schön, dass Sie da sind! Sie haben <b>{x}</b> gewonnen.",
        x={"10": "10 % Rabatt auf Ihre erste Bestellung", "15": "15 % Rabatt auf Ihre erste Bestellung", "versand": "gratis Versand für Ihre erste Bestellung"},
        betreff={"10": "Willkommen bei Eveom – hier ist Ihr 10 %-Code 🎁", "15": "Willkommen bei Eveom – hier ist Ihr 15 %-Code 🎁", "versand": "Willkommen bei Eveom – hier ist Ihr Gratis-Versand-Code 🎁"},
    ),
    "nl": dict(
        intro="gefeliciteerd met uw prijs – en fijn dat u er bent! U heeft <b>{x}</b> gewonnen.",
        x={"10": "10% korting op uw eerste bestelling", "15": "15% korting op uw eerste bestelling", "versand": "gratis verzending voor uw eerste bestelling"},
        betreff={"10": "Welkom bij Eveom – hier is uw kortingscode van 10% 🎁", "15": "Welkom bij Eveom – hier is uw kortingscode van 15% 🎁", "versand": "Welkom bij Eveom – hier is uw code voor gratis verzending 🎁"},
    ),
    "fr": dict(
        intro="félicitations pour votre gain – et bienvenue chez Eveom ! Vous avez gagné <b>{x}</b>.",
        x={"10": "10 % de réduction sur votre première commande", "15": "15 % de réduction sur votre première commande", "versand": "la livraison offerte sur votre première commande"},
        betreff={"10": "Bienvenue chez Eveom – voici votre code de 10 % 🎁", "15": "Bienvenue chez Eveom – voici votre code de 15 % 🎁", "versand": "Bienvenue chez Eveom – voici votre code livraison offerte 🎁"},
    ),
    "en": dict(
        intro="congratulations on your prize – and great to have you here! You’ve won <b>{x}</b>.",
        x={"10": "10% off your first order", "15": "15% off your first order", "versand": "free shipping on your first order"},
        betreff={"10": "Welcome to Eveom – here’s your 10% code 🎁", "15": "Welcome to Eveom – here’s your 15% code 🎁", "versand": "Welcome to Eveom – here’s your free shipping code 🎁"},
    ),
}


def gewinn_mail(preis, lang):
    basis, g = MAILS["willkommen-1-standard"][lang], GEWINN[lang]
    absaetze = [g["intro"].replace("{x}", g["x"][preis]),
                basis["absaetze"][1].replace(COUPONS["standard"], COUPONS[preis]),
                basis["absaetze"][2]]
    if preis != "versand":
        absaetze.append(basis["absaetze"][3])
    return dict(basis, betreff=g["betreff"][preis], absaetze=absaetze)


MAILS = {
    **{f"willkommen-1-{p}": {lang: gewinn_mail(p, lang) for lang in GEWINN} for p in ("10", "15", "versand")},
    **MAILS,
}

GRUND = {"willkommen": "grund_liste", "checkout": "grund_kauf", "nachkauf": "grund_kauf"}


def render(key, lang):
    m, t = MAILS[key][lang], L[lang]
    grund = t[GRUND[key.split("-")[0]]]
    paras = "".join(p if p.startswith("<") else f"<p>{p}</p>" for p in m["absaetze"])
    label, url = m["button"]
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(m['betreff'])}</title>
</head>
<body style="margin:0;padding:0;background:#7D000D;">
<div style="display:none;max-height:0;overflow:hidden;">{html.escape(m['vorschau'])}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#7D000D" style="background:#7D000D;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;font-family:Helvetica,Arial,sans-serif;color:#2b2b2b;">
        <tr>
          <td style="padding:28px 32px 4px;font-size:22px;font-weight:bold;letter-spacing:3px;">EVEOM</td>
        </tr>
        <tr>
          <td style="padding:12px 0 8px;"><a href="{PRODUCT[lang]}"><img src="{HERO}" width="560" alt="Eveom Astaxanthin" style="display:block;width:100%;height:auto;border:0;"></a></td>
        </tr>
        <tr>
          <td style="padding:8px 32px 28px;font-size:16px;line-height:1.6;">
            <p>{t['hallo']}</p>
            {paras}
            <p style="margin:28px 0;text-align:center;"><a href="{url}" style="display:inline-block;background:#7D000D;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;">{html.escape(label)}</a></p>
            <p>{t['gruss']}<br>{t['absenderin']}<br>Team Eveom™</p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Helvetica,Arial,sans-serif;">
        <tr>
          <td style="padding:16px 32px;font-size:12px;line-height:1.5;color:#f1d9dc;text-align:center;">
            {grund}<br>{{% unsubscribe '{t['abmelden']}' %}} · <a href="{SHOP}/policies/legal-notice" style="color:#f1d9dc;">{t['impressum']}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
"""


def plain(key, lang):
    m, t = MAILS[key][lang], L[lang]
    body = "\n\n".join(re.sub(r"<br>", "\n", re.sub(r"<(?!br)[^>]+>", "", p)) for p in m["absaetze"] if not p.startswith(("<table", "<p style"))) 
    label, url = m["button"]
    return f"{t['hallo']}\n\n{body}\n\n{label}: {url}\n\n{t['gruss']}\n{t['absenderin']}\nTeam Eveom™"


# Beispielwerte nur für die Vorschau-Datei
SAMPLE = [
    (r"\{% if person.first_name %\}(.*?)\{% (?:else %\}.*?\{% )?endif %\}", lambda m: m.group(1)),
    (r"\{\{ person.first_name \}\}", lambda m: "Anna"),
    (r"\{% coupon_code '[^']+' %\}", lambda m: "WK10-7QX4P"),
    (r"\{% for item in event.extra.line_items %\}(.*?)\{% endfor %\}",
     lambda m: m.group(1).replace("{{ item.product.title }}", "Eveom Astaxanthin 12 MG").replace("{{ item.quantity|floatformat:0 }}", "1")),
    (r"\{\{ event.extra.checkout_url[^}]*\}\}", lambda m: SHOP + "/cart"),
    (r"\{% unsubscribe '([^']+)' %\}", lambda m: f'<a href="#" style="color:#f1d9dc;">{m.group(1)}</a>'),
]


def sample(s):
    for pattern, repl in SAMPLE:
        s = re.sub(pattern, repl, s, flags=re.S)
    return s


TITEL = {
    "willkommen-1-10": "Willkommens-Serie · Mail 1 · Gewinn 10 % Rabatt",
    "willkommen-1-15": "Willkommens-Serie · Mail 1 · Gewinn 15 % Rabatt",
    "willkommen-1-versand": "Willkommens-Serie · Mail 1 · Gewinn Gratis Versand",
    "willkommen-1-standard": "Willkommens-Serie · Mail 1 · Anmeldung ohne Glücks-Pop-up (10 %)",
    "willkommen-2": "Willkommens-Serie · Mail 2 · nach 2 Tagen (nur wenn noch nicht bestellt)",
    "willkommen-3": "Willkommens-Serie · Mail 3 · nach 11 Tagen (nur wenn noch nicht bestellt)",
    "checkout-1": "Abgebrochener Checkout · Mail 1 · nach 1 Stunde",
    "checkout-2": "Abgebrochener Checkout · Mail 2 · nach 24 Stunden",
    "checkout-3": "Abgebrochener Checkout · Mail 3 · nach 3 Tagen",
    "nachkauf-1": "Nachkauf-Erinnerung · 25 Tage nach dem Kauf (1 Dose)",
}
SPRACHE = {"de": "Deutsch", "nl": "Niederländisch", "fr": "Französisch", "en": "Englisch"}


def main():
    out, cards = {}, []
    for key in MAILS:
        for lang in ("de", "nl", "fr", "en"):
            m = MAILS[key][lang]
            out[f"{key}-{lang}"] = dict(
                name=f"Eveom · {key} · {lang.upper()}",
                betreff=m["betreff"],
                vorschau=m["vorschau"],
                html=render(key, lang),
                text=plain(key, lang),
            )
            doc = html.escape(sample(render(key, lang)), quote=True)
            cards.append(
                f'<section><h2>{TITEL[key]} · {SPRACHE[lang]}</h2>'
                f'<p class="meta"><b>Betreff:</b> {html.escape(m["betreff"])}<br><b>Vorschautext:</b> {html.escape(m["vorschau"])}</p>'
                f'<iframe srcdoc="{doc}" loading="lazy"></iframe></section>'
            )
    (HERE / "mails.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    (HERE / "vorschau.html").write_text(
        "<!DOCTYPE html><html lang=de><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
        "<title>Eveom Klaviyo-Mails</title><style>body{margin:0;padding:16px;font-family:Helvetica,Arial,sans-serif;background:#f4f1ec;color:#2b2b2b}"
        "h1{font-size:22px}h2{font-size:16px;margin:0 0 6px}.meta{font-size:14px;margin:0 0 8px}"
        "section{max-width:640px;margin:0 auto 32px}iframe{width:100%;height:760px;border:0;border-radius:12px;background:#7D000D}</style>"
        "<h1 style='max-width:640px;margin:0 auto 20px'>Eveom · Klaviyo-Mails (Entwurf, nichts ist live)</h1>"
        + "".join(cards) + "</html>"
    )
    print(len(out), "Mails erzeugt")


if __name__ == "__main__":
    main()
