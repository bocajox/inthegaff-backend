const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.belvoir.co.uk';

module.exports = {
  id: 'belvoir',
  name: 'Belvoir Manchester',
  website: BASE,
  areas: ['Manchester City Centre', 'Salford', 'Hulme', 'Ardwick', 'Rusholme', 'Chorlton', 'Didsbury'],

  async scrape() {
    const listings = [];
    const seen = new Set();

    // Belvoir is a franchise — must use branch-specific URLs
    // Manchester Central, Manchester Chorlton, and Manchester North are the relevant branches
    const branchPages = [
      `${BASE}/manchester-central-estate-agents/properties/for-rent/`,
      `${BASE}/estate-agents-and-letting-agents/branch/manchester-central/property-to-rent/`,
      `${BASE}/estate-agents-and-letting-agents/branch/manchester-chorlton/property-to-rent/`,
      `${BASE}/estate-agents-and-letting-agents/branch/manchester-north/property-to-rent/`,
    ];

    for (const branchUrl of branchPages) {
      let page = 1;

      while (true) {
        let url;
        if (page === 1) {
          url = branchUrl;
        } else {
          url = `${branchUrl.replace(/\/$/, '')}/page/${page}/`;
        }

        let $;
        try {
          $ = await fetchHTML(url);
        } catch (e) {
          break;
        }

        // Belvoir-specific selectors
        let cards = $('[class*="property-card"], [class*="property_card"], .property-listing, .property-item').toArray();

        if (!cards.length) {
          cards = $('article.property, .property, ul.properties li').toArray();
        }

        if (!cards.length) {
          cards = $('a, div, article').filter((i, el) => {
            const $el = $(el);
            const text = $el.text();
            return (text.includes('\u00a3') || $el.find('[class*="price"]').length > 0) &&
                   ($el.find('a[href*="/property/"]').length > 0 || $el.is('a[href*="/property/"]')) &&
                   text.length < 2000 &&
                   $el.children().length < 20;
          }).toArray();
        }

        // Broader fallback
        if (!cards.length) {
          cards = $('div, li').filter((i, el) => {
            const $el = $(el);
            return ($el.text().includes('\u00a3') || $el.find('[class*="price"]').length > 0) &&
                   $el.find('img').length > 0 &&
                   $el.find('a').length > 0 &&
                   $el.children().length >= 2 &&
                   $el.children().length < 15 &&
                   $el.text().length < 1500;
          }).toArray();
        }

        if (!cards.length) break;

        let foundAny = false;
        for (const card of cards) {
          try {
            const el = $(card);

            let href = el.is('a') ? el.attr('href') : '';
            if (!href) {
              href = el.find('a[href*="/property/"], a[href*="/properties/"], a').first().attr('href') || '';
            }
            if (!href || href === '#') continue;

            const fullUrl = href.startsWith('http') ? href : BASE + href;
            if (seen.has(fullUrl)) continue;
            seen.add(fullUrl);

            const extId = href.replace(/\/$/, '').split('/').pop() || href;

            const priceStr = el.find('[class*="price"]').first().text().trim() ||
                            el.text().match(/\u00a3[\d,]+\s*(?:pcm|pm|PCM|PM)?/)?.[0] || '';
            const price = parsePrice(priceStr);
            if (!price || price > 10000) continue;

            const address = el.find('[class*="address"], h2, h3, h4, h5, .card-title, [class*="title"]').first().text().trim();
            const bedsStr = el.find('[class*="bed"]').first().text().trim();
            const imgSrc = extractImage(el.find('img').first());

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
              parking: hasFeature(desc, ['parking', 'garage']),
              pets: hasFeature(desc, ['pets']),
              garden: hasFeature(desc, ['garden']),
              balcony: hasFeature(desc, ['balcony', 'terrace']),
              listingUrl: fullUrl,
            });
            foundAny = true;
          } catch (e) {
            continue;
          }
        }

        if (!foundAny) break;

        const hasNext = $('a[rel="next"], .next, a:contains("Next"), [aria-label="Next"]').length > 0;
        if (!hasNext || page >= 5) break;
        page++;
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    return listings;
  },
};
