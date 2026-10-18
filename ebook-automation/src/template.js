// Füllt eine HTML-E-Mail-Vorlage. Der Betreff steht im <title>-Tag der Vorlage,
// Platzhalter haben die Form {{first_name}}.

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fill(text, vars, escape) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    if (!(key in vars)) return match;
    return escape ? escapeHtml(vars[key]) : String(vars[key] ?? '');
  });
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function htmlToText(html) {
  const text = html
    .replace(/<(style|script|title|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text)
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function renderTemplate(source, vars) {
  const titleMatch = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) throw new Error('Vorlage hat keinen <title> (wird als Betreff benutzt)');
  const subject = decodeEntities(fill(titleMatch[1], vars, false)).replace(/\s+/g, ' ').trim();
  const html = fill(source, vars, true);
  return { subject, html, text: htmlToText(html) };
}
