const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.martinco.com';

module.exports = {
  id:      'martinco',
  name:    'Martin & Co',
  website: BASE,
  areas:   ['Chorlton', 'Fallowfield', 'Withington', 'Manchester City Centre'],

  async scrape() {
    const listings = [];
    // Martin & Co is a franchise — try a few branch URL patterns
    const branchUrls = [
      `${BASE}/branch/manchester-chorlton/properties/let/`,
      `${BASE}/branch/manchester/properties/let/`,
      `${BASE}/search/?instruction_type=Letting&location=Manchester`,
      `${BASE}/property/to-rent/?location=Manchester`,
    ];

    for (const branchUrl of branchUrls) {
      let page = 1;
      while (true) {
        const sep = branchUrl.includes('?') ? '&' : '?';
        const url = page === 1 ? branchUrl : `${branchUrl}${sep}page=${page}`;
        let $;
        try { $ = await fetchHTML(url); } catch (e) { break; }

        let cards = $(
          '[class*="property-card"], .property-card, article.property, ' +
          '[data-property], [class*="PropertyCard"], [class*="property-item"], ' +
          '[class*="listing-card"], .search-result'
        ).filter((i, el) => $(el).find('[class*="price"]').length > 0).toArray();

        if (!cards.length) {
          cards = $('article, li.result').filter((i, el) =>
            $(el).find('[class*="price"]').length > 0
          ).toArray();
        }
        if (!cards.length) break;

        for (const card of cards) {
          const el      = $(card);
          const link    = el.find('a').first();
          const href    = link.attr('href') || '';
          const fullUrl = href.startsWith('http') ? href : BASE + href;
          const extId   = href.replace(/\/$/, '').split('/').pop() || href;

          const priceStr = el.find('[class*="price"], [class*="Price"]').first().text().trim();
          const address  = el.find('[class*="address"], [class*="Address"], h2, h3').first().text().trim();
          const bedsStr  = el.find('[class*="bed"], [class*="Bed"]').first().text().trim();
          const imgSrc   = extractImage(el.find('img').first());

          const price = parsePrice(priceStr);
          if (!price) continue;

          const postcode = extractPostcode(address);
          const area     = guessArea(address, postcode);
          const desc     = el.find('[class*="desc"], p').first().text().trim();

          listings.push({
            externalId:  extId,
            title:       address,
            price,
            beds:        parseBeds(bedsStr || address),
            type:        parseType(address),
            area,
            street:      address,
            postcode,
            description: desc,
            photos:      imgSrc ? [imgSrc] : [],
            features:    [],
            furnished:   hasFeature(desc, ['furnished']),
            parking:     hasFeature(desc, ['parking']),
            pets:        hasFeature(desc, ['pets']),
            garden:      hasFeature(desc, ['garden']),
            balcony:     hasFeature(desc, ['balcony']),
            listingUrl:  fullUrl,
          });
        }

        const hasNext = $('a[rel="next"], .pagination .next, [aria-label="Next"]').length > 0;
        if (!hasNext || page >= 10) break;
        page++;
        await new Promise(r => setTimeout(r, 1500));
      }
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
