const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.thornleygroves.co.uk';

module.exports = {
  id:      'thornleygroves',
  name:    'Thornley Groves',
  website: BASE,
  areas:   ['Chorlton', 'Didsbury', 'Withington', 'Sale', 'Ancoats', 'Northern Quarter'],

  async scrape() {
    const listings = [];
    let   page     = 1;

    while (true) {
      const url = `${BASE}/property/to-rent/in-manchester-and-cheshire/?page=${page}`;
      let $;
      try { $ = await fetchHTML(url); } catch (e) { break; }

      // Very broad selector — filter down by presence of a price element
      let cards = $(
        '[class*="PropertyCard"], [class*="property-card"], [class*="property-item"], ' +
        '[class*="PropertyResult"], [class*="property-result"], ' +
        '[class*="listing-card"], [class*="listing-item"], ' +
        'article.property, article[class*="prop"], .property, .property-card'
      ).filter((i, el) => $(el).find('[class*="price"], [class*="Price"]').length > 0).toArray();

      // Fallback: any article or section that contains a price
      if (!cards.length) {
        cards = $('article, section, li, .card').filter((i, el) =>
          $(el).find('[class*="price"], [class*="Price"]').length > 0
        ).toArray();
      }
      if (!cards.length) break;

      for (const card of cards) {
        const el      = $(card);
        const link    = el.find('a[href*="/property/"], a[href*="to-rent"], a[href*="lettings"]').first();
        const href    = link.attr('href') || el.find('a').first().attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId   = href.replace(/\/$/, '').split('/').pop() || href;

        const priceStr  = el.find('[class*="price"], [class*="Price"]').first().text().trim();
        const titleStr  = el.find('[class*="address"], [class*="Address"], [class*="title"], h2, h3').first().text().trim();
        const bedsStr   = el.find('[class*="beds"], [class*="Beds"], [class*="bedroom"]').first().text().trim();
        const imgSrc    = extractImage(el.find('img').first());

        const price    = parsePrice(priceStr);
        if (!price) continue;

        const postcode = extractPostcode(titleStr);
        const area     = guessArea(titleStr, postcode);
        const desc     = el.find('[class*="description"], [class*="Description"], p').first().text().trim();

        listings.push({
          externalId:  extId,
          title:       titleStr,
          price,
          beds:        parseBeds(bedsStr || titleStr),
          type:        parseType(titleStr),
          area,
          street:      titleStr,
          postcode,
          description: desc,
          photos:      imgSrc ? [imgSrc] : [],
          features:    [],
          furnished:   hasFeature(desc + titleStr, ['furnished']),
          parking:     hasFeature(desc + titleStr, ['parking', 'garage']),
          pets:        hasFeature(desc + titleStr, ['pets considered', 'pets welcome']),
          garden:      hasFeature(desc + titleStr, ['garden', 'yard']),
          balcony:     hasFeature(desc + titleStr, ['balcony', 'terrace']),
          listingUrl:  fullUrl,
        });
      }

      const hasNext = $('a[rel="next"], [class*="pagination"] a:contains("Next"), [aria-label="Next"]').length > 0;
      if (!hasNext || page >= 20) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
