const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.montroseproperties.co.uk';

module.exports = {
  id: 'montrose',
  name: 'Montrose Properties',
  website: BASE,
  areas: ['Didsbury', 'Withington', 'Fallowfield', 'Chorlton', 'Rusholme'],

  async scrape() {
    const listings = [];

    // Try multiple URL patterns — Montrose is a small agent
    const urls = [
      `${BASE}/search/?department=residential-lettings`,
      `${BASE}/search/`,
      `${BASE}/to-let/`,
      `${BASE}/lettings/`,
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
        const pageUrl = workingUrl.includes('?')
          ? `${workingUrl}&paged=${page}`
          : `${workingUrl}page/${page}/`;
        try { $ = await fetchHTML(pageUrl); } catch (e) { break; }
      }

      let cards = $('[class*="property-card"], [class*="property_card"], .property, ul.properties li, a.card, article').filter((i, el) => {
        return $(el).text().includes('\u00a3') || $(el).find('[class*="price"]').length > 0;
      }).toArray();
      if (!cards.length) break;

      for (const card of cards) {
        const el = $(card);
        const link = el.is('a') ? el : el.find('a[href*="propert"], a').first();
        const href = link.attr('href') || '';
        if (!href || href === '#') continue;
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId = href.replace(/\/$/, '').split('/').pop() || href;

        const priceStr = el.find('[class*="price"]').first().text().trim()
          || el.text().match(/\u00a3[\d,]+/)?.[0] || '';
        const address = el.find('[class*="address"], h2, h3, h4, .card-title').first().text().trim();
        const imgSrc = extractImage(el.find('img').first());

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
          furnished: false,
          parking: false,
          pets: false,
          garden: false,
          balcony: false,
          listingUrl: fullUrl,
        });
      }

      const hasNext = $('a[rel="next"], .next, a:contains("Next")').length > 0;
      if (!hasNext || page >= 5) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
