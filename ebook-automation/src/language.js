// Ermittelt Land und Sprache einer Bestellung.

export function orderCountry(order) {
  return (
    order.billingAddress?.countryCodeV2 ||
    order.shippingAddress?.countryCodeV2 ||
    order.customer?.defaultAddress?.countryCodeV2 ||
    null
  );
}

export function pickLanguage(order, config) {
  const country = orderCountry(order);
  const mapped = country ? config.countryToLanguage[country] : undefined;
  if (mapped && config.languages[mapped]) return { country, language: mapped };
  return { country, language: config.defaultLanguage };
}
