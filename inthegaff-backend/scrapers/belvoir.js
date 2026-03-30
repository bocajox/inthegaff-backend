const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.belvoir.co.uk';

module.exports = {
  id: 'belvoir',
  name: 'Belvoir',
  website: BASE,
  areas: ['Manchester City Centre', 'Salford', 'Chorlton', 'Didsbury'],

  async scrape() {
    const listings = [];

    const urls = [
      `${BASE}/manchester/property-to-rent/`,
      `${BASE}/manchester/properties/to-rent/`,
      `${BASE}/offices/manchester/properties/`,
    ];

    let $ = null;
    let workingUrl = null;
    for (const url of urls) {
      try {
        $ = await fetchHTML(url);
        if ($.text().includes('\u00a3') || $('[class*="property"]').length > 0) {
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

      let cards = $('[class*="property-card"], .property-card, article.property, [class*="listing"]').filter((i, el) => {
        return $(el).text().includes('\u00a3') || $(el).find('[class*="price"]').length > 0;
      }).toArray();
      if (!cards.length) {
        cards = $('article, .card').filter((i, el) => {
          return $(el).find('[class*="price"]').length > 0 || $(el).text().includes('\u00a3');
        }).toArray();
      }
      if (!cards.length) break;

      for (const card of cards) {
        const el = $(card);
        const href = el.find('a[href*="propert"], a[href*="let"], a[href*="rent"]').first().attr('href')
          || el.find('a').first().attr('href') || '';
        if (!href || href === '#') continue;
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId = href.replace(/\/$/, '').split('/').pop() || href;

        const priceStr = el.find('[class*="price"]').first().text().trim()
          || el.text().match(/\u00a3[\d,]+/)?.[0] || '';
        const address = el.find('[class*="address"], h2, h3').first().text().trim();
        const bedsStr = el.find('[class*="bed"]').first().text().trim();
        const imgSrc = extractImage(el.find('img').first());

        const price = parsePrice(priceStr);
        if (!price || price > 10000) continue;

        const postcode = extractPostcode(address);
        const area = guessArea(address, postcode);
        const desc = el.find('p, [class*="desc"]').first().text().trim();

        listings.push({
          externalId: extId,
          title: address,
          price,
          beds: parseBeds(bedsStr || address),
          type: parseType(address),
          area,
          street: address,
          postcode,
          description: desc,
          photos: imgSrc ? [imgSrc] : [],
          features: [],
          furnished: hasFeature(desc, ['furnished']),
          parking:   hasFeature(desc, ['parking']),
          pets:      hasFeature(desc, ['pets']),
          garden:    hasFeature(desc, ['garden']),
          balcony:   hasFeature(desc, ['balcony']),
          listingUrl: fullUrl,
        });
      }

      const hasNext = $('a[rel="next"], .next').length > 0;
      if (!hasNext || page >= 5) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
