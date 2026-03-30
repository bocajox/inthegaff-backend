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
      const url = `${BASE}/property/to-rent/in-south-manchester/?page=${page}`;
      let $;
      try { $ = await fetchHTML(url); } catch (e) { break; }

      // Thornley Groves (Gatsby SSR) — cards are div.sales-wrap inside div.sales-wrapper
      // Each card: div.sales-wrap > div.sales-img-wrap (image) + div.slide-content (info)
      const cards = $('div.sales-wrap').toArray();

      // Fallback: try broader selectors in case they change class names
      if (!cards.length) {
        const fallback = $('[class*="property-card"], [class*="sales-wrap"], article.property')
          .filter((i, el) => $(el).find('a[href*="/property"]').length > 0).toArray();
        if (!fallback.length) break;
        cards.push(...fallback);
      }

      if (!cards.length) break;

      for (const card of cards) {
        const el = $(card);

        // Link: a tag inside sales-img-wrap pointing to /property-to-rent/...
        const link = el.find('a[href*="/property-to-rent/"], a[href*="/property/"]').first();
        const href = link.attr('href') || '';
        if (!href) continue;
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId = href.replace(/\/$/, '').split('/').pop() || href;

        // Price: p.highlight-text or div.content containing £
        const priceStr = el.find('p.highlight-text, div.content').first().text().trim();

        // Address: h3 inside slide-content
        const titleStr = el.find('h3').first().text().trim();

        // Type: span.count.prop_type
        const typeStr = el.find('span.count.prop_type, span.prop_type').first().text().trim();

        // Beds: span.count elements (beds, baths, receptions — beds is first numeric one)
        const bedsStr = el.find('span.count').not('.prop_type').first().text().trim();

        // Image: img inside sales-img-wrap — uses srcset and src
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
          parking: hasFeature(desc + titleStr, ['parking', 'garage']),
          pets: hasFeature(desc + titleStr, ['pets considered', 'pets welcome']),
          garden: hasFeature(desc + titleStr, ['garden', 'yard']),
          balcony: hasFeature(desc + titleStr, ['balcony', 'terrace']),
          listingUrl: fullUrl,
        });
      }

      // Pagination — check for next page link
      const hasNext = $('a[rel="next"], [class*="pagination"] a:contains("Next"), [aria-label="Next"]').length > 0;
      if (!hasNext || page >= 20) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
