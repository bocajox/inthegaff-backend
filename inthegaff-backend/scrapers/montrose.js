const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.montroseproperties.co.uk';

module.exports = {
  id: 'montrose',
  name: 'Montrose Properties',
  website: BASE,
  areas: ['Didsbury', 'Withington', 'Fallowfield', 'Chorlton', 'Rusholme'],

  async scrape() {
    const listings = [];
    const seen = new Set();

    // Montrose uses /letting/ (NOT /lettings/) as their main page
    // Also try /search-printable/ which has all properties
    const urls = [
      `${BASE}/letting/`,
      `${BASE}/search-printable/`,
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
        if ($.text().includes('\u00a3') || $('[class*="property"]').length > 0 || $('a[href*="propert"]').length > 0) {
          workingUrl = url;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!workingUrl || !$) return listings;

    let page = 1;

    while (true) {
      if (page > 1) {
        const pageUrl = workingUrl.includes('?')
          ? `${workingUrl}&paged=${page}`
          : `${workingUrl.replace(/\/$/, '')}/page/${page}/`;
        try {
          $ = await fetchHTML(pageUrl);
        } catch (e) {
          break;
        }
      }

      let cards = $('[class*="property-card"], [class*="property_card"], .property-listing, .property-item').toArray();
      if (!cards.length) cards = $('ul.properties li, .propertyhive-property, article.property, a.card').toArray();
      if (!cards.length) {
        cards = $('article, .card, div, li').filter((i, el) => {
          const $el = $(el);
          return ($el.text().includes('\u00a3') || $el.find('[class*="price"]').length > 0) &&
                 ($el.find('a[href*="propert"]').length > 0 || $el.find('a').length > 0) &&
                 $el.find('img').length > 0 &&
                 $el.children().length >= 2 && $el.children().length < 20 && $el.text().length < 2000;
        }).toArray();
      }
      if (!cards.length) break;

      for (const card of cards) {
        try {
          const el = $(card);
          const link = el.is('a') ? el : el.find('a[href*="propert"], a[href*="letting"], a').first();
          const href = link.attr('href') || '';
          if (!href || href === '#') continue;
          const fullUrl = href.startsWith('http') ? href : BASE + href;
          if (seen.has(fullUrl)) continue;
          seen.add(fullUrl);
          const extId = href.replace(/\/$/, '').split('/').pop() || href;
          const priceStr = el.find('[class*="price"]').first().text().trim() ||
                          el.text().match(/\u00a3[\d,]+\s*(?:pcm|pm)?/i)?.[0] || '';
          const price = parsePrice(priceStr);
          if (!price || price > 10000) continue;
          const address = el.find('[class*="address"], h2, h3, h4, .card-title, [class*="title"]').first().text().trim();
          const bedsStr = el.find('[class*="bed"]').first().text().trim();
          const imgSrc = extractImage(el.find('img').first());
          const postcode = extractPostcode(address);
          const area = guessArea(address, postcode);
          const desc = el.find('p, [class*="desc"]').first().text().trim();
          listings.push({
            externalId: extId, title: address, price, beds: parseBeds(bedsStr || address),
            type: parseType(address), area, street: address, postcode, description: desc,
            photos: imgSrc ? [imgSrc] : [], features: [],
            furnished: hasFeature(desc, ['furnished']), parking: hasFeature(desc, ['parking']),
            pets: hasFeature(desc, ['pets']), garden: hasFeature(desc, ['garden']),
            balcony: hasFeature(desc, ['balcony']), listingUrl: fullUrl,
          });
        } catch (e) { continue; }
      }

      const hasNext = $('a[rel="next"], .next, a:contains("Next"), [aria-label="Next"]').length > 0;
      if (!hasNext || page >= 5) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
