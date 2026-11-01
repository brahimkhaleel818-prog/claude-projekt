#!/usr/bin/env python3
"""Packt crisp-bestelluebersicht.js in den Garantie-Block (eveom-garantie.html).

CrispCheckout führt <script> in Custom-HTML-Blöcken nicht aus – onload-Attribute
aber schon. Darum steht der Code HTML-kodiert in einem unsichtbaren <img onload>.
Aufruf: python3 shopify-sections/build-garantie.py
"""
import html, pathlib, re

ordner = pathlib.Path(__file__).parent
js = (ordner / 'crisp-bestelluebersicht.js').read_text()
js = '\n'.join(z.strip() for z in js.splitlines() if z.strip() and not z.strip().startswith('//'))
gif = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
img = f'<!--EV-SUM--><img class="eveom-g__lang" alt="" width="1" height="1" src="{gif}" onload="{html.escape(js, quote=True)}"><!--/EV-SUM-->'

ziel = ordner / 'eveom-garantie.html'
text = ziel.read_text()
if '<!--EV-SUM-->' in text:
    text = re.sub(r'<!--EV-SUM-->.*?<!--/EV-SUM-->', lambda m: img, text, flags=re.S)
else:
    text = text.replace('\n</div>\n\n<style>', '\n  ' + img + '\n</div>\n\n<style>', 1)
ziel.write_text(text)
print(f'{ziel.name}: {len(text)} Zeichen')
