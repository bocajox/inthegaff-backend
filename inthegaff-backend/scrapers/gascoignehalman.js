const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.gascoignehalman.co.uk';

module.exports = {
  id: 'gascoignehalman',
  name: 'Gascoigne Halman',
  website: BASE,
  areas: ['Didsbury', 'Chorlton', 'Sale', 'Altrincham', 'Wilmslow'],

  async scrape() {
    const listings = [];

    const urls = [
      `${BASE}/search/?instruction_type=Let`,
      `${BASE}/search/?instruction_type=Letting`,
      `${BASE}/properties/to-rent/`,
      `${BASE}/search/to-rent/`,
    ];

    let $ = null;
    let workingUrl = null;
    for (const url of urls) {
      try {
        $ = await fetchHTML(url);
        if ($.text().includes('\u00a3') || $('[class*="property"]').length > 2) {
          workingUrl = url;
          break;
        }
      } catch (e) { continue; }
    }
    if (!workingUrl || !$) return listings;

    let page = 1;
    while (true) {
      if (page > 1) {
        const sep = workingUrl.includes('?') ? '&' : '?';
        try { $ = await fetchHTML(`${workingUrl}${sep}page=${page}`); } catch (e) { break; }
      }

      let cards = $('[class*="property-card"], [class*="property_card"], .property-card, article.property, [class*="result"]').filter((i, el) => {
        return $(el).text().includes('\u00a3') || $(el).find('[class*="price"]').length > 0;
      }).toArray();
      if (!cards.length) break;

      for (const card of cards) {
        const el = $(card);
        const href = el.find('a[href*="propert"], a[href*="let"], a').first().attr('href') || '';
        if (!href || href === '#') continue;
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId = href.replace(/\/$/, '').split('/').pop() || href;

        const priceStr = el.find('[class*="price"]').first().text().trim()
          || el.text().match(/\u00a3[\d,]+/)?.[0] || '';
        const address = el.find('[class*="address"], h2, h3, h4').first().text().trim();
        const bedsStr = el.find('[class*="bed"]').first().text().trim();
        const imgSrc = extractImage(el.find('img').first());

        const price = parsePrice(priceStr);
        if (!price) continue;

        // Only include PCM prices (lettings), not sale prices
        if (price > 10000) continue;

        const postcode = extractPostcode(address);
        const area = guessArea(address, postcode);

        listings.push({
          externalId: extId,
          title: address,
          price,
          beds: parseBeds(bedsStr || address),
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

      const hasNext = $('a[rel="next"], .next, [aria-label="Next"]').length > 0;
      if (!hasNext || page >= 8) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
