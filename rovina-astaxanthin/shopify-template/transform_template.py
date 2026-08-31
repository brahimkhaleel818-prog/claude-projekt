#!/usr/bin/env python3
"""
Transform the Eveom Mitochondrial product template into
Rovina SunGlow Astaxanthin 12mg product template.

All customer-facing text → Dutch
All branding → Rovina
All content → Astaxanthin-relevant
All colors → Rovina Red palette
"""

import json
import re
import copy

# Load the template
with open('/tmp/claude-0/astaxanthine_template.json') as f:
    content = f.read()
content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL).strip()
tmpl = json.loads(content)

# Deep copy for modification
t = copy.deepcopy(tmpl)

# ═══════════════════════════════════════════════════════════════
# COLOR MAPPING: Eveom Green → Rovina Red
# ═══════════════════════════════════════════════════════════════
COLOR_MAP = {
    "#243918": "#8B1A1A",      # dark green → dark red
    "#2b5e0e": "#B91C1C",      # CTA green → Rovina red
    "#2c4a2c": "#8B1A1A",      # accent green → dark red
    "#dcfaa5": "#FECACA",      # light green badge → light red
    "#011208": "#3B0404",      # very dark green → very dark red
    "#1b9999": "#B91C1C",      # teal → red
    "#158b8b": "#991B1B",      # teal active → dark red
    "#4caf50": "#EF4444",      # green radio → red
    "#28a745": "#EF4444",      # green savings → red
}

def replace_colors_in_str(s):
    """Replace Eveom colors with Rovina colors in a string."""
    if not isinstance(s, str):
        return s
    result = s
    for old, new in COLOR_MAP.items():
        result = result.replace(old, new)
        result = result.replace(old.upper(), new)
        result = result.replace(old.lower(), new.lower())
    # Also replace rgba versions
    result = result.replace("rgba(36, 57, 24,", "rgba(139, 26, 26,")
    result = result.replace("rgba(36, 57, 24 ", "rgba(139, 26, 26 ")
    result = result.replace("rgba(32, 57, 26,", "rgba(139, 26, 26,")
    result = result.replace("rgba(43, 94, 14,", "rgba(185, 28, 28,")
    result = result.replace("rgba(44, 35, 74,", "rgba(139, 26, 26,")
    result = result.replace("rgba(44, 74, 44,", "rgba(139, 26, 26,")
    return result

def replace_colors_recursive(obj):
    """Recursively replace colors in all string values."""
    if isinstance(obj, dict):
        return {k: replace_colors_recursive(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [replace_colors_recursive(item) for item in obj]
    elif isinstance(obj, str):
        return replace_colors_in_str(obj)
    return obj

# Apply color replacements globally
t = replace_colors_recursive(t)

# ═══════════════════════════════════════════════════════════════
# MAIN PRODUCT SECTION
# ═══════════════════════════════════════════════════════════════
main = t['sections']['main']
blocks = main['blocks']

# --- Title ---
blocks['title']['settings']['custom_title'] = "Rovina SunGlow Astaxanthin 12mg"

# --- Rating Stars ---
blocks['rating_stars_pTTC7n']['settings']['richtext_content'] = '<p>beoordeeld <strong>4.8/5</strong> door <strong>100.000+ klanten</strong></p>'
blocks['rating_stars_pTTC7n']['settings']['rating'] = 4.8

# --- Social Subheading ---
blocks['social_subheading_RLF4U9']['settings']['text_after'] = "DE KRACHTIGSTE ANTIOXIDANT UIT PURE MICROALGEN"

# --- Product Text Block ---
blocks['product_text_block_nGaaBH']['settings']['text'] = (
    '<p>Bescherm je cellen met de <strong>krachtigste antioxidant</strong> uit de natuur. '
    'Rovina SunGlow levert de volledige klinische dosis van <strong>12mg astaxanthine</strong> per softgel, '
    'gewonnen uit pure <em>Haematococcus pluvialis</em> microalgen.</p>'
    '<p>✓ 6.000x krachtiger dan Vitamine C<br/>'
    '✓ Ondersteunt huid, gewrichten & energie<br/>'
    '✓ 90 dagen niet-goed-geld-terug-garantie</p>'
)

# --- Benefits (custom_liquid_mq3XU6) - benefit icons ---
benefits_html = '''<style>
.ev-benefits{
  display:flex !important;
  flex-direction:column !important;
  gap:14px !important;
  padding:6px 0 !important;
  margin:0 !important;
}
.ev-benefit{
  display:flex !important;
  align-items:center !important;
  gap:12px !important;
}
.ev-benefit img{
  width:38px !important;
  height:auto !important;
  max-height:none !important;
  object-fit:contain !important;
  border-radius:0 !important;
  flex:0 0 38px !important;
  display:block !important;
}
.ev-benefit span{
  font-size:14px !important;
  font-weight:500 !important;
  color:#1a1a1a !important;
  line-height:1.3 !important;
}
</style>
<div class="ev-benefits">
  <div class="ev-benefit">
    <span style="font-size:24px;">🛡️</span>
    <span>Cellulaire & Antioxidant Bescherming*</span>
  </div>
  <div class="ev-benefit">
    <span style="font-size:24px;">🔥</span>
    <span>Ondersteunt een Gezonde Ontstekingsreactie*</span>
  </div>
  <div class="ev-benefit">
    <span style="font-size:24px;">✨</span>
    <span>Huid, Energie & Gezond Verouderen*</span>
  </div>
</div>'''
blocks['custom_liquid_mq3XU6']['settings']['custom_liquid'] = benefits_html

# --- Low Stock Banner (custom_liquid_z4qNjX) ---
low_stock_html = '''<section class="low-stock-banner">
  <div class="low-stock-banner__inner">
    <div class="low-stock-banner__icon">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8b1e1e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="11" x2="12" y2="17"/>
        <circle cx="12" cy="7.5" r="0.6" fill="#8b1e1e" stroke="none"/>
      </svg>
    </div>
    <div class="low-stock-banner__text">
      <strong>LAGE VOORRAAD</strong> — Bestel nu, voordat het uitverkocht is!
    </div>
  </div>
</section>
<style>
.low-stock-banner{padding:10px 0;font-family:inherit}
.low-stock-banner__inner{display:flex;align-items:center;gap:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px}
.low-stock-banner__icon svg{width:20px;height:20px}
.low-stock-banner__text{font-size:13px;color:#991b1b;line-height:1.4}
.low-stock-banner__text strong{font-weight:700}
</style>'''
blocks['custom_liquid_z4qNjX']['settings']['custom_liquid'] = low_stock_html

# --- Bundle Selector (qb_row_no_variant) ---
qb = blocks['qb_row_no_variant_mtfWBB']['settings']
# Use Rovina Astaxanthin product images from Shopify CDN
astax_1 = "shopify://shop_images/5cf3cc72-bf8d-45c8-bc04-30a5d9de3559_817ccb35-7ab6-48db-8f08-b96656825d8e.png"
astax_3 = "shopify://shop_images/a29af8cb-3448-42a3-9082-2dd214f135bf_3a06c9ed-40da-4626-a92b-8050a73f0b18.png"
astax_5 = "shopify://shop_images/ee4fc1fe-5234-4e26-9e4c-2b595e66813b_3e560093-08dc-49c5-bf71-385d112e7e2b.png"

qb['qb1_image'] = astax_1
qb['qb1_title'] = "Bestel 1"
qb['qb1_text'] = "€39,90/zakje"
qb['qb1_enable_badge'] = False

qb['qb2_image'] = astax_3
qb['qb2_title'] = "Bestel 2 + 1 gratis"
qb['qb2_text'] = "€26,60/zakje"
qb['qb2_enable_badge'] = True
qb['qb2_badge_text'] = "BESTSELLER"
qb['qb2_badge_color'] = "#ffffff"
qb['qb2_badge_bg_color'] = "#B91C1C"

qb['qb3_image'] = astax_5
qb['qb3_title'] = "Bestel 3 + 2 gratis"
qb['qb3_text'] = "€23,49/zakje"
qb['qb3_enable_badge'] = True
qb['qb3_badge_text'] = "BESTE WERKING"
qb['qb3_badge_color'] = "#ffffff"
qb['qb3_badge_bg_color'] = "#7F1D1D"

# Bundle colors
qb['inactive_border_color'] = "#D1D5DB"
qb['inactive_bg_color'] = "#FFF7ED"
qb['active_border_color'] = "#B91C1C"
qb['active_bg_color'] = "#8B1A1A"
qb['title_text_color'] = "#1F2937"
qb['title_text_color_active'] = "#ffffff"
qb['price_text_color'] = "#B91C1C"
qb['qb_active_price_color'] = "#FECACA"
qb['qb_active_title_color'] = "#ffffff"

# --- Subscription Widget ---
sub = blocks['subscription_widget_NfyeHR']['settings']
sub['sub_widget_onetime_payment_text'] = "<p>Eenmalige Aankoop</p>"
sub['sub_widget_subscription_payment_text'] = "<p>Abonneer & <strong>Bespaar</strong></p>"
sub['sub_widget_frequency_title'] = "Bezorgfrequentie"
# Update the subscription expanded content
sub_expanded = sub.get('sub_widget_html_subscription_expanded', '')
sub_expanded = sub_expanded.replace('Cancel any time', 'Op elk moment opzeggen')
sub_expanded = sub_expanded.replace('Save 45%', 'Bespaar')
sub_expanded = sub_expanded.replace('Exclusive Promotions', 'Exclusieve Aanbiedingen')
sub_expanded = sub_expanded.replace('Cancel anytime', 'Op elk moment opzeggen')
sub['sub_widget_html_subscription_expanded'] = sub_expanded
sub['sub_widget_radio_unchecked_color'] = "#8B1A1A"

# --- Buy Button ---
buy = blocks['buy_buttons']['settings']
buy['button_label'] = "Nu Bestellen"
buy['custom_color'] = "#B91C1C"
buy['button_border_color'] = "#B91C1C"
buy['button_gradient'] = "radial-gradient(rgba(185, 28, 28, 1) 100%, rgba(139, 26, 26, 1) 100%)"
buy['enable_button_gradient'] = False

# --- Benefit Pills ---
pills = blocks['benefit_pills_UTVaPp']['settings']
pills['pill_1_text'] = "Snelle Verzending"
pills['pill_2_text'] = "Veilig Betalen"
pills['pill_3_text'] = "Snelle Levering"

# --- Product Flag (US Flag → NL Flag) ---
flag = blocks['product_flag_qn3MLq']['settings']
nl_flag_svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 9 6">
<rect fill="#21468B" width="9" height="6"/>
<rect fill="#FFF" width="9" height="4"/>
<rect fill="#AE1C28" width="9" height="2"/>
</svg>'''
flag['icon_1_svg'] = nl_flag_svg
# Keep the second icon or update
flag['show_two_items'] = True

# --- Delivery Date ---
delivery = blocks['delivery_date_wiADyG']['settings']
delivery['delivery_text'] = '<p>Bestelling wordt bezorgd op <strong>[date]</strong></p>'
delivery['date_format'] = "[day] [date] [month]"

# --- Money Back Guarantee (custom_liquid_4mRaHK) ---
mbg_html = '''<!-- Shopify Custom Code: Money Back Guarantee Badge -->
<section class="mbg-section">
  <div class="mbg-badge">
    <svg class="mbg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" id="mbg-svg"></svg>
    <p class="mbg-text">Minder dan 1% van onze klanten maakt gebruik van onze Geld-Terug-Garantie.</p>
  </div>
</section>
<style>
  .mbg-section{padding:12px 16px;font-family:inherit}
  .mbg-badge{display:flex;align-items:center;gap:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 18px}
  .mbg-icon{width:32px;height:32px;flex-shrink:0}
  .mbg-text{font-size:12px;color:#7f1d1d;line-height:1.5;margin:0}
</style>'''
blocks['custom_liquid_4mRaHK']['settings']['custom_liquid'] = mbg_html

# --- Dietary Badges (custom_liquid_GqjHaz) ---
dietary_html = '''<!-- Shopify Custom Code Section: Dietary Badges -->
<section class="dietary-badges">
  <div class="dietary-badges__inner">
    <div class="dietary-badges__item">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="36" height="36" fill="none" stroke="#8B1A1A" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="40" cy="40" r="37" stroke-width="2.2"/>
        <text x="40" y="46" text-anchor="middle" font-size="20" fill="#8B1A1A" stroke="none" font-weight="bold">GMO</text>
        <line x1="15" y1="65" x2="65" y2="15" stroke-width="2.5"/>
      </svg>
      <span class="dietary-badges__label">GMO-vrij</span>
    </div>
    <div class="dietary-badges__item">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="36" height="36" fill="none" stroke="#8B1A1A" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="40" cy="40" r="37" stroke-width="2.2"/>
        <path d="M30 28 Q40 50 50 28" stroke-width="2"/>
        <line x1="15" y1="65" x2="65" y2="15" stroke-width="2.5"/>
      </svg>
      <span class="dietary-badges__label">Glutenvrij</span>
    </div>
    <div class="dietary-badges__item">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="36" height="36" fill="none" stroke="#8B1A1A" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="40" cy="40" r="37" stroke-width="2.2"/>
        <path d="M32 30 L32 55 Q40 60 48 55 L48 30 Z" stroke-width="2"/>
        <line x1="15" y1="65" x2="65" y2="15" stroke-width="2.5"/>
      </svg>
      <span class="dietary-badges__label">Zuivelvrij</span>
    </div>
  </div>
</section>
<style>
.dietary-badges{padding:20px 0;font-family:inherit}
.dietary-badges__inner{display:flex;justify-content:center;gap:32px;flex-wrap:wrap}
.dietary-badges__item{display:flex;flex-direction:column;align-items:center;gap:6px}
.dietary-badges__label{font-size:11px;font-weight:600;color:#8B1A1A;text-transform:uppercase;letter-spacing:0.5px}
</style>'''
blocks['custom_liquid_GqjHaz']['settings']['custom_liquid'] = dietary_html

# ═══════════════════════════════════════════════════════════════
# HERO BENEFITS SECTION
# ═══════════════════════════════════════════════════════════════
hero = t['sections']['hero_benefits_mEzLgj']
hs = hero['settings']
hs['heading_before'] = "Antioxidantbescherming Begint Op"
hs['highlighted_text'] = "Cellulair Niveau"
hs['intro_text'] = "<p>Er zit veel meer in Rovina SunGlow Astaxanthin dan je denkt...</p>"

# Hero benefit blocks
hblocks = hero['blocks']
benefits_data = [
    {
        'id': 'benefit_item_cEcYfm',
        'label': 'Cellulaire Bescherming',
        'icon_google_name': 'shield',
        'description': (
            'Astaxanthine is de enige antioxidant die zowel water- als vetoplosbaar is. '
            'Het verankert zich over het gehele celmembraan voor uitgebreide cellulaire bescherming tegen oxidatieve stress.*'
        ),
        'reviewer_name': 'Sophie V.',
        'review_text': '"Mijn huid ziet er stralender uit en ik voel me energieker sinds ik dit neem."'
    },
    {
        'id': 'benefit_item_keLT63',
        'label': 'Huid & Veroudering',
        'description': (
            'Astaxanthine beschermt de huidcellen van binnenuit tegen UV-schade en oxidatieve stress, '
            'wat bijdraagt aan een gezondere, jongere uitstraling na verloop van tijd.*'
        ),
        'reviewer_name': 'Marieke D.',
        'review_text': '"Na 6 weken merkte ik een duidelijk verschil in mijn huid. Gladder en stralender."'
    },
    {
        'id': 'benefit_item_H4hqJj',
        'label': 'Ontstekingsbalans',
        'icon_google_name': 'balance',
        'description': (
            'Klinisch onderzoek toont aan dat astaxanthine een gezonde ontstekingsreactie ondersteunt. '
            'Dit helpt bij gewrichtscomfort en dagelijks welzijn.*'
        ),
        'reviewer_name': 'Jan K.',
        'review_text': '"Mijn gewrichten voelen soepeler aan, vooral \'s ochtends bij het opstaan."'
    },
    {
        'id': 'benefit_item_QxpMYn',
        'label': 'Energie & Vitaliteit',
        'icon_google_name': 'bolt',
        'description': (
            'Door mitochondriën te beschermen tegen oxidatieve schade, '
            'ondersteunt astaxanthine de natuurlijke energieproductie en dagelijkse vitaliteit.*'
        ),
        'reviewer_name': 'Linda M.',
        'review_text': '"Ik heb meer energie door de dag heen. Geen dip meer in de middag."'
    },
]
for bd in benefits_data:
    bid = bd['id']
    if bid in hblocks:
        hblocks[bid]['settings']['label'] = bd['label']
        hblocks[bid]['settings']['description'] = bd['description']
        hblocks[bid]['settings']['reviewer_name'] = bd['reviewer_name']
        hblocks[bid]['settings']['review_text'] = bd['review_text']
        if 'icon_google_name' in bd:
            hblocks[bid]['settings']['icon_google_name'] = bd['icon_google_name']

# ═══════════════════════════════════════════════════════════════
# CUSTOMER REVIEW SLIDER
# ═══════════════════════════════════════════════════════════════
reviews = t['sections']['customer_review_slider_WUXp4w']
rs = reviews['settings']
rs['section_review_count'] = '<p><strong>+3.847 beoordelingen</strong> van echte klanten</p>'
rs['heading_before'] = "Geloof ons niet op ons woord,"
rs['highlighted_text'] = "vertrouw onze klanten"
rs['intro_text'] = '<p>Echte verhalen van klanten die onze producten waarderen.</p>'
rs['verified_badge_text'] = "Geverifieerde Koper"

# Replace review blocks content with Dutch Astaxanthin reviews
review_data = [
    {
        'text': '<p>Ik had altijd last van een doffe, vermoeide huid. Na ongeveer 5 weken Rovina SunGlow merkte ik een echt verschil — mijn huid ziet er gezonder en stralender uit. Een vriendin vroeg zelfs of ik iets nieuws deed!</p>',
    },
    {
        'text': '<p>Na jarenlang last te hebben van stijve gewrichten probeerde ik van alles. Na 6 weken Rovina SunGlow voel ik me veel soepeler. Ik kan weer makkelijker traplopen en dat maakt een enorm verschil in mijn dagelijks leven.</p>',
    },
    {
        'text': '<p>Mijn ogen voelden altijd vermoeid aan na een lange dag achter het beeldscherm. Sinds ik Rovina SunGlow neem, merk ik dat mijn ogen minder snel vermoeid raken. Een subtiel maar waardevol verschil.</p>',
    },
    {
        'text': '<p>Ik was sceptisch, maar na 4 weken consistent gebruik merk ik echt verschil in mijn energieniveau. Geen middag-dip meer en ik slaap ook beter. Dit is nu een vast onderdeel van mijn routine.</p>',
    },
    {
        'text': '<p>Als sportliefhebber zocht ik iets voor spierherstel. Rovina SunGlow helpt me sneller te herstellen na intensieve trainingen. Minder spierpijn de dag erna — dat is precies wat ik nodig had.</p>',
    },
]
review_blocks = reviews.get('blocks', {})
for i, (bid, block) in enumerate(review_blocks.items()):
    if i < len(review_data):
        block['settings']['review_text'] = review_data[i]['text']

# ═══════════════════════════════════════════════════════════════
# STAT BAR SECTION
# ═══════════════════════════════════════════════════════════════
stat = t['sections']['stat_bar_section_VmABKY']
ss = stat['settings']
ss['heading_before'] = "Echte Resultaten. Echte Vooruitgang."
ss['highlighted_text'] = "Liegen Nooit!"
ss['intro_text'] = '<p>Ontdek hoe klanten dagelijks hun welzijn ondersteunen met Rovina SunGlow.</p>'

stat_labels = [
    "Verbeterd Huidbeeld",
    "Dagelijks Consistent Gebruik",
    "Verhoogde Dagelijkse Energie",
]
for i, (bid, block) in enumerate(stat.get('blocks', {}).items()):
    if i < len(stat_labels):
        block['settings']['stat_label'] = stat_labels[i]

# ═══════════════════════════════════════════════════════════════
# CUSTOM LIQUID SECTION (Rigorous Testing)
# ═══════════════════════════════════════════════════════════════
cl = t['sections']['custom_liquid_qahWhh']
cl_content = cl['settings'].get('custom_liquid', '')
# Replace English text with Dutch
cl_content = cl_content.replace('Rigorous testing that sets a higher standard.', 'Strenge testen die een hogere standaard zetten.')
cl_content = cl_content.replace(
    'Mitochondrial&trade; is screened as a full formula for allergens, contaminants, and pesticides&mdash;because what&rsquo;s not in your supplement matters, too.',
    'Rovina SunGlow&trade; wordt als volledige formule gescreend op allergenen, verontreinigingen en pesticiden — want wat er niet in je supplement zit, is net zo belangrijk.'
)
cl_content = cl_content.replace('Formulated without common allergens', 'Geformuleerd zonder veelvoorkomende allergenen')
cl_content = cl_content.replace('Heavy metal and pesticide tested', 'Getest op zware metalen en pesticiden')
cl_content = cl_content.replace('Prop. 65 compliant', 'Voldoet aan EU-voedselveiligheidsnormen')
cl_content = cl_content.replace('Transparent ingredient sourcing', 'Transparante herkomst van ingrediënten')
cl_content = cl_content.replace('heavy metals and pesticides', 'zware metalen en pesticiden')
cl_content = cl_content.replace('common allergens', 'veelvoorkomende allergenen')
cl_content = cl_content.replace('transparent ingredient', 'transparante ingrediënt')
cl_content = cl_content.replace('Mitochondrial', 'Rovina SunGlow')
cl['settings']['custom_liquid'] = cl_content

# ═══════════════════════════════════════════════════════════════
# INTERACTIVE HOTSPOT IMAGE (Ingredients)
# ═══════════════════════════════════════════════════════════════
hotspot = t['sections']['interactive_hotspot_image_N4LeKT']
hs2 = hotspot['settings']
hs2['highlighted_text'] = "Klinisch Onderzocht"
hs2['heading_after'] = "Ingrediënten Voor Uitgebreide Cellulaire Bescherming"
hs2['intro_text'] = '<p>Elk ingrediënt is geselecteerd om cellulaire bescherming, antioxidantactiviteit en algeheel welzijn te ondersteunen — op cellulair niveau.</p>'

# ═══════════════════════════════════════════════════════════════
# ANIMATED PROGRESS SECTIONS (How to Use)
# ═══════════════════════════════════════════════════════════════
progress = t['sections']['animated_progress_sections_XdHNkD']
ps = progress['settings']
ps['heading_before'] = "Hoe te gebruiken"
ps['intro_text'] = (
    '<p>Consistentie is de sleutel bij het opbouwen van cellulaire bescherming.'
    '<br/><br/>Volg dit eenvoudige dagelijkse protocol voor langdurige ondersteuning.</p>'
)

progress_blocks = list(progress.get('blocks', {}).values())
if len(progress_blocks) >= 3:
    progress_blocks[0]['settings']['heading'] = "Neem Dagelijks 1 Softgel Met Voedsel"
    progress_blocks[0]['settings']['content'] = (
        "Neem je softgel bij een maaltijd, bij voorkeur 's ochtends of in de vroege middag "
        "om de natuurlijke cellulaire bescherming te ondersteunen. Astaxanthine is vetoplosbaar — "
        "neem het met een vetbevattende maaltijd voor optimale opname."
    )
    progress_blocks[1]['settings']['heading'] = "Blijf Consistent Gedurende 4–8 Weken"
    progress_blocks[1]['settings']['content'] = (
        "Cellulaire bescherming bouwt zich geleidelijk op.\n"
        "De meeste klanten merken subtiele verbeteringen na 3-4 weken, "
        "met volledige voordelen die pieken rond week 6-8.*\n"
        "Hoe langer je het neemt, hoe meer het zich opbouwt."
    )
    progress_blocks[2]['settings']['heading'] = "Ondersteun Met Beweging & Hydratatie"
    progress_blocks[2]['settings']['content'] = (
        "Dagelijkse beweging en voldoende hydratatie bevorderen de opname "
        "van voedingsstoffen en ondersteunen algeheel welzijn."
    )

# Button block
if len(progress_blocks) >= 4:
    progress_blocks[3]['settings']['button_text'] = "NU BESTELLEN"
    progress_blocks[3]['settings']['button_link'] = "shopify://products/eveom-astaxanthine-de-krachtigste-antioxidant-van-de-natuur-voor-ondersteuning-van-het-hele-lichaam-cellulaire-bescherming-1"

# ═══════════════════════════════════════════════════════════════
# FAQ SECTION
# ═══════════════════════════════════════════════════════════════
faq = t['sections']['faq_accordion_4_xrF4JJ']
fs = faq['settings']
fs['highlighted_text'] = "veelgestelde vragen"
fs['intro_text'] = '<p>Vind antwoorden op veelgestelde vragen over onze producten en diensten.</p>'

faq_data = [
    {
        'question': 'Wanneer kan ik resultaten verwachten van Rovina SunGlow?',
        'answer': (
            '<p>Iedereen is uniek, dus individuele resultaten kunnen variëren. Omdat astaxanthine '
            'zich geleidelijk opbouwt in je lichaam, merken de meeste klanten subtiele verbeteringen '
            'na 3-4 weken. Volledige voordelen pieken doorgaans rond week 6-8.*</p>'
            '<p>Vroege tekenen kunnen zijn:</p>'
            '<ul><li>Meer energie door de dag heen</li>'
            '<li>Verbeterd huidbeeld</li>'
            '<li>Minder stijve gewrichten</li>'
            '<li>Algeheel welzijnsgevoel</li></ul>'
        )
    },
    {
        'question': 'Werkt Rovina SunGlow ook als ik geen grote levensstijlveranderingen maak?',
        'answer': (
            '<p>Rovina SunGlow is geen wondermiddel. Het is een krachtige antioxidant die je lichaam '
            'van binnenuit ondersteunt. Het werkt het beste als onderdeel van een gezonde levensstijl, '
            'maar veel klanten melden verbeteringen zelfs zonder drastische veranderingen — '
            'gewoon door consistent dagelijks 1 softgel te nemen.*</p>'
        )
    },
    {
        'question': 'Bevat Rovina SunGlow cafeïne of andere stimulerende middelen?',
        'answer': (
            '<p>Nee. Deze formule is 100% cafeïnevrij en vrij van stimulerende middelen. '
            'Alle ingrediënten zijn natuurlijk gewonnen uit microalgen. Het is veilig om dagelijks '
            'te nemen zonder invloed op je slaap of energiepieken.*</p>'
        )
    },
    {
        'question': 'Waar wordt Rovina SunGlow geproduceerd? Is het onafhankelijk getest?',
        'answer': (
            '<p>Rovina SunGlow wordt geproduceerd in een GMP-gecertificeerde faciliteit en is '
            'onafhankelijk getest door derden. Elke batch wordt gecontroleerd op zuiverheid, '
            'potentie en verontreinigingen. Non-GMO, glutenvrij en sojavrij.</p>'
        )
    },
    {
        'question': 'Wat zijn de exacte ingrediënten in deze formule?',
        'answer': (
            '<p>Elke softgel bevat:</p>'
            '<p><strong>Astaxanthine 12mg</strong> — gewonnen uit <em>Haematococcus pluvialis</em> microalgen</p>'
            '<p><strong>Biologische Kokosolie</strong> — voor optimale biobeschikbaarheid</p>'
            '<p><strong>Softgel capsule</strong> — gelatine, glycerine, water</p>'
            '<p>Zonder: kunstmatige kleurstoffen, conserveringsmiddelen, gluten, soja, GMO, vulstoffen.</p>'
        )
    },
]
faq_blocks = list(faq.get('blocks', {}).values())
for i, fd in enumerate(faq_data):
    if i < len(faq_blocks):
        faq_blocks[i]['settings']['question'] = fd['question']
        faq_blocks[i]['settings']['answer'] = fd['answer']

# ═══════════════════════════════════════════════════════════════
# US VS THEM (disabled but update for completeness)
# ═══════════════════════════════════════════════════════════════
uvt = t['sections'].get('us_vs_them_AXwQiN', {})
if uvt:
    us = uvt.get('settings', {})
    us['heading_before'] = "Wat Rovina SunGlow"
    us['highlighted_text'] = "Onderscheidt"

# ═══════════════════════════════════════════════════════════════
# ENABLE PREVIOUSLY DISABLED SECTIONS THAT ARE RELEVANT
# ═══════════════════════════════════════════════════════════════
# Enable us_vs_them for Rovina
if 'us_vs_them_AXwQiN' in t['sections']:
    t['sections']['us_vs_them_AXwQiN']['disabled'] = False
    uvt_s = t['sections']['us_vs_them_AXwQiN']['settings']
    uvt_s['heading_before'] = "Wat Rovina SunGlow"
    uvt_s['highlighted_text'] = "Onderscheidt"

# ═══════════════════════════════════════════════════════════════
# GLOBAL: Fix any remaining English/Eveom references
# ═══════════════════════════════════════════════════════════════
def global_replace(obj):
    """Replace remaining English/Eveom text globally."""
    if isinstance(obj, dict):
        return {k: global_replace(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [global_replace(item) for item in obj]
    elif isinstance(obj, str):
        s = obj
        # Brand replacements
        s = s.replace('Eveom™ I Mitochondrial', 'Rovina SunGlow Astaxanthin 12mg')
        s = s.replace('Eveom™', 'Rovina')
        s = s.replace('Eveom', 'Rovina')
        s = s.replace('Mitochondrial™', 'Rovina SunGlow™')
        s = s.replace('Mitochondrial&trade;', 'Rovina SunGlow&trade;')
        # Be careful not to replace 'Mitochondrial' in medical/scientific context
        # Only replace when it's clearly a product name (capitalized, standalone)
        s = s.replace('eveom™-mitochondrial', 'eveom-astaxanthine-de-krachtigste-antioxidant-van-de-natuur-voor-ondersteuning-van-het-hele-lichaam-cellulaire-bescherming-1')
        return s
    return obj

t = global_replace(t)

# ═══════════════════════════════════════════════════════════════
# SAVE THE TRANSFORMED TEMPLATE
# ═══════════════════════════════════════════════════════════════
# Add the Shopify comment header back
header = """/*
 * ------------------------------------------------------------
 * IMPORTANT: The contents of this file are auto-generated.
 *
 * This file may be updated by the Shopify admin theme editor
 * or related systems. Please exercise caution as any changes
 * made to this file may be overwritten.
 * ------------------------------------------------------------
 */
"""
output = header + json.dumps(t, indent=2, ensure_ascii=False)

with open('/tmp/claude-0/rovina/product.json', 'w') as f:
    f.write(output)

print(f"Template saved: {len(output)} chars")
print("Transformation complete!")

# Verify no remaining English text in key fields
import re
remaining = []
def check_english(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            check_english(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            check_english(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        # Check for obvious English words that should be translated
        english_words = ['Buy Now', 'Add to Cart', 'Free Shipping', 'Best Value', 'Popular']
        for word in english_words:
            if word in obj:
                remaining.append(f"{path}: contains '{word}'")

check_english(t)
if remaining:
    print("\n⚠️ Remaining English text found:")
    for r in remaining:
        print(f"  {r}")
else:
    print("\n✅ No obvious English text remaining")
