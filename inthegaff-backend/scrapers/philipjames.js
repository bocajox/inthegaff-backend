const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.philipjames.co.uk';

module.exports = {
  id: 'philipjames',
  name: 'Philip James',
  website: BASE,
  areas: ['Didsbury', 'Chorlton', 'Fallowfield', 'Withington', 'Manchester City Centre'],

  async scrape() {
    const listings = [];
    let page = 1;

    while (true) {
      // Correct URL: /property-search/ (NOT /search/?department=...)
      const url = page === 1
        ? `${BASE}/property-search/?department=residential-lettings`
        : `${BASE}/property-search/page/${page}/?department=residential-lettings`;

      let $;
      try { $ = await fetchHTML(url); } catch (e) {
        // If department filter fails, try without it
        if (page === 1) {
          try { $ = await fetchHTML(`${BASE}/property-search/`); } catch (e2) { break; }
        } else { break; }
      }

      // Philip James uses div cards with .details class
      // Also try PropertyHive and general selectors
      let cards = $('div').filter((i, el) => {
        const $el = $(el);
        return $el.find('img').length > 0
          && $el.find('a[href*="/property/"]').length > 0
          && $el.text().includes('\u00a3')
          && $el.children().length >= 2
          && $el.children().length < 15
          && $el.text().length < 1000;
      }).toArray();

      if (!cards.length) {
        cards = $('ul.properties li, .propertyhive-property, a.card, [class*="property-card"]').toArray();
      }
      if (!cards.length) {
        cards = $('article').filter((i, el) => {
          return $(el).text().includes('\u00a3');
        }).toArray();
      }
      if (!cards.length) break;

      const seen = new Set();
      for (const card of cards) {
        try {
          const el = $(card);
          const link = el.is('a') ? el : el.find('a[href*="/property/"], a').first();
          const href = link.attr('href') || '';
          if (!href || href === '#' || seen.has(href)) continue;
          seen.add(href);
          const fullUrl = href.startsWith('http') ? href : BASE + href;
          const extId = href.replace(/\/$/, '').split('/').pop() || href;

          const priceStr = el.find('.price, [class*="price"]').first().text().trim()
            || el.text().match(/\u00a3[\d,]+\s*(?:pcm|pm|PCM)?/)?.[0] || '';
          const address = el.find('.address, [class*="address"], h2, h3, h4, h5, .card-title').first().text().trim();
          const bedsStr = el.find('[class*="bed"], .beds').first().text().trim();
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
            parking:   hasFeature(desc, ['parking', 'garage']),
            pets:      hasFeature(desc, ['pets']),
            garden:    hasFeature(desc, ['garden']),
            balcony:   hasFeature(desc, ['balcony', 'terrace']),
            listingUrl: fullUrl,
          });
        } catch (e) { continue; }
      }

      const hasNext = $('a[rel="next"], .next, a:contains("Next"), [aria-label="Next"]').length > 0;
      if (!hasNext || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
