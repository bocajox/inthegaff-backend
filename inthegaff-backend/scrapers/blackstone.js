const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://blackstoneestateagent.co.uk';

module.exports = {
  id: 'blackstone',
  name: 'Black Stone Estate Agents',
  website: BASE,
  areas: ['Levenshulme', 'Gorton', 'Longsight', 'Burnage'],

  async scrape() {
    const listings = [];
    const url = `${BASE}/houses-letting-agency-in-manchester/`;

    let $;
    try { $ = await fetchHTML(url); } catch (e) { return listings; }

    let cards = $('a[href*="/property/"], a[href*="/properties/"]').toArray();
    if (!cards.length) {
      cards = $('[class*="property"], .listing, article').filter((i, el) => {
        return $(el).text().includes('£');
      }).toArray();
    }

    const seen = new Set();
    for (const card of cards) {
      const el = $(card);
      const href = el.is('a') ? el.attr('href') : el.find('a').first().attr('href') || '';
      if (!href || href === '#' || seen.has(href)) continue;
      seen.add(href);

      const fullUrl = href.startsWith('http') ? href : BASE + href;
      const extId = href.replace(/\/$/, '').split('/').pop() || href;

      const parent = el.closest('[class*="property"], .card, article, div').length ? el.closest('[class*="property"], .card, article') : el;
      const priceStr = parent.find('[class*="price"]').first().text().trim()
        || parent.text().match(/£[\d,]+/)?.[0] || '';
      const address = parent.find('[class*="address"], h2, h3, h4, h5').first().text().trim()
        || el.text().trim();
      const imgSrc = extractImage(parent.find('img').first());

      const price = parsePrice(priceStr);
      if (!price) continue;

      const postcode = extractPostcode(address);
      const area = guessArea(address, postcode);

      listings.push({
        externalId: extId,
        title: address,
        price,
        beds: parseBeds(address),
        type: parseType(address),
        area,
        street: address,
        postcode,
        description: '',
        photos: imgSrc ? [imgSrc] : [],
        features: [],
        furnished: false, parking: false, pets: false, garden: false, balcony: false,
        listingUrl: fullUrl,
      });
    }

    return listings;
  },
};
