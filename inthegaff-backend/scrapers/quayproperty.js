const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.quayproperty.com';

module.exports = {
  id: 'quayproperty',
  name: 'Quay Property',
  website: BASE,
  areas: ['Salford Quays', 'MediaCity', 'Castlefield', 'Manchester City Centre'],

  async scrape() {
    const listings = [];
    let page = 1;

    while (true) {
      const url = page === 1
        ? `${BASE}/search/`
        : `${BASE}/search/?searchPageNum=${page}`;

      let $;
      try { $ = await fetchHTML(url); } catch (e) { break; }

      // Primary selector: .actual-property (each property card)
      let cards = $('.actual-property').toArray();
      if (!cards.length) {
        cards = $('.actual-property-result').toArray();
      }
      if (!cards.length) break;

      for (const card of cards) {
        try {
          const el = $(card);
          const link = el.find('a').first();
          const href = link.attr('href') || '';
          if (!href || href === '#') continue;

          const fullUrl = href.startsWith('http') ? href : BASE + href;
          const extId = href.replace(/\/$/, '').split('/').pop() || href;

          const priceStr = el.find('[class*="price"]').first().text().trim()
            || el.text().match(/\u00a3[\d,]+/)?.[0] || '';
          const address = el.find('[class*="address"], h2, h3, h4, .card-title, [class*="title"]').first().text().trim();
          const bedsStr = el.find('[class*="bed"]').first().text().trim();

          // FIX: Quay Property images are set via inline JS: var res = 'URL'
          // Extract image URL from <script> tags within or near the card
          let imgSrc = '';
          const scriptTags = el.find('script').toArray();
          for (const script of scriptTags) {
            const scriptText = $(script).html() || '';
            const resMatch = scriptText.match(/var\s+res\s*=\s*['"]([^'"]+)['"]/);
            if (resMatch && resMatch[1] && resMatch[1].startsWith('http')) {
              imgSrc = resMatch[1];
              break;
            }
          }
          // Fallback: try extractImage helper
          if (!imgSrc) {
            imgSrc = extractImage(el.find('img').first());
          }
          // Fallback: check parent/sibling scripts
          if (!imgSrc) {
            const parentScripts = el.parent().find('script').toArray();
            for (const script of parentScripts) {
              const scriptText = $(script).html() || '';
              const resMatch = scriptText.match(/var\s+res\s*=\s*['"]([^'"]+)['"]/);
              if (resMatch && resMatch[1] && resMatch[1].startsWith('http')) {
                imgSrc = resMatch[1];
                break;
              }
            }
          }

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
            parking: hasFeature(desc, ['parking']),
            pets: hasFeature(desc, ['pets']),
            garden: hasFeature(desc, ['garden']),
            balcony: hasFeature(desc, ['balcony']),
            listingUrl: fullUrl,
          });
        } catch (e) { continue; }
      }

      const hasNext = $('a[rel="next"], .next, [class*="pagination"] a:contains("Next")').length > 0;
      if (!hasNext || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
