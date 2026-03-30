const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.thornleygroves.co.uk';

module.exports = {
  id: 'thornleygroves',
  name: 'Thornley Groves',
  website: BASE,
  areas: ['Chorlton', 'Didsbury', 'Withington', 'Sale', 'Ancoats', 'Northern Quarter'],

  async scrape() {
    const listings = [];
    let page = 1;

    while (true) {
      const url = page === 1
        ? `${BASE}/property/to-rent/in-south-manchester/`
        : `${BASE}/property/to-rent/in-south-manchester/?page=${page}`;

      let $;
      try { $ = await fetchHTML(url); } catch (e) { break; }

      const cards = $('div.sales-wrap').toArray();
      if (!cards.length) break;

      for (const card of cards) {
        const el = $(card);
        const link = el.find('a[href*="/property-to-rent/"]').first();
        const href = link.attr('href') || '';
        if (!href) continue;
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId = el.attr('id') || href.replace(/\/$/, '').split('/').pop();

        const priceStr = el.find('p.highlight-text').first().text().trim();
        const titleStr = el.find('h3').first().text().trim();
        const typeStr  = el.find('span.count.prop_type, span.prop_type').first().text().trim();

        // Beds: span.count elements — first is type, second is beds
        const countEls = el.find('span.count').not('.prop_type').toArray();
        const bedsStr  = countEls.length ? $(countEls[0]).text().trim() : '';

        const imgSrc = extractImage(el.find('.sales-img-wrap img, .sales-img img, img').first());

        const price = parsePrice(priceStr);
        if (!price) continue;

        const postcode = extractPostcode(titleStr);
        const area = guessArea(titleStr, postcode);
        const desc = el.find('[class*="description"], p').not('.highlight-text').first().text().trim();

        listings.push({
          externalId: extId,
          title: titleStr,
          price,
          beds: parseBeds(bedsStr || titleStr),
          type: typeStr ? parseType(typeStr) : parseType(titleStr),
          area,
          street: titleStr,
          postcode,
          description: desc,
          photos: imgSrc ? [imgSrc] : [],
          features: [],
          furnished: hasFeature(desc + titleStr, ['furnished']),
          parking:   hasFeature(desc + titleStr, ['parking', 'garage']),
          pets:      hasFeature(desc + titleStr, ['pets considered', 'pets welcome']),
          garden:    hasFeature(desc + titleStr, ['garden', 'yard']),
          balcony:   hasFeature(desc + titleStr, ['balcony', 'terrace']),
          listingUrl: fullUrl,
        });
      }

      const hasNext = $('a[rel="next"], [class*="pagination"] a:contains("Next"), [aria-label="Next"]').length > 0;
      if (!hasNext || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
