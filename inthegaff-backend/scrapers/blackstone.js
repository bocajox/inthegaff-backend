const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://blackstoneestateagent.co.uk';

module.exports = {
  id: 'blackstone',
  name: 'Black Stone Estate Agents',
  website: BASE,
  areas: ['Levenshulme', 'Gorton', 'Longsight', 'Burnage'],

  async scrape() {
    const listings = [];

    const url = `${BASE}/houses-letting-agency-in-manchester/`;
    let $;
    try { $ = await fetchHTML(url); } catch (e) { return listings; }

    // Black Stone uses WPL (WordPress Property Listing) plugin
    // Property containers: .wpl_prp_cont
    let cards = $('.wpl_prp_cont').toArray();

    if (!cards.length) {
      // Fallback: look for owl carousel items with property data
      cards = $('.wpl-carousel-item, .owl-item').filter((i, el) => {
        return $(el).text().includes('\u00a3') && $(el).find('img').length > 0;
      }).toArray();
    }

    if (!cards.length) {
      // Broader: find containers with property links
      cards = $('a[href*="/property/"], a[href*="/properties/"]').toArray();
    }

    const seen = new Set();
    for (const card of cards) {
      try {
        const el = $(card);

        // Get link
        let href = el.is('a') ? el.attr('href') : '';
        if (!href) {
          href = el.find('a[href*="/property/"], a[href*="/properties/"], a').first().attr('href') || '';
        }
        if (!href || href === '#' || seen.has(href)) continue;
        seen.add(href);
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId = href.replace(/\/$/, '').split('/').pop() || href;

        // WPL elements: .wpl_prp_title for title, .wpl_prp_listing_location for location
        const titleEl = el.find('.wpl_prp_title, h3, h4, [class*="title"]').first();
        const address = titleEl.text().trim()
          || el.find('.wpl_prp_listing_location, [class*="location"], [class*="address"]').first().text().trim()
          || el.closest('[class*="wpl"]').find('.wpl_prp_title').first().text().trim();

        // Price from WPL or general
        const priceStr = el.find('[class*="price"], .wpl_prp_listing_price').first().text().trim()
          || el.closest('[class*="wpl"]').find('[class*="price"]').first().text().trim()
          || el.text().match(/\u00a3[\d,]+/)?.[0] || '';
        const price = parsePrice(priceStr);
        if (!price || price > 10000) continue;

        // Image from WPL
        const img = el.find('img').first();
        const imgSrc = img.length ? (img.attr('data-src') || img.attr('src') || '') : '';
        const photo = imgSrc && !imgSrc.startsWith('data:') ? (imgSrc.startsWith('http') ? imgSrc : BASE + imgSrc) : '';

        const postcode = extractPostcode(address);
        const area = guessArea(address, postcode);

        listings.push({
          externalId: extId,
          title: address,
          price,
          beds: parseBeds(address || el.text()),
          type: parseType(address || el.text()),
          area,
          street: address,
          postcode,
          description: '',
          photos: photo ? [photo] : [],
          features: [],
          furnished: false,
          parking: false,
          pets: false,
          garden: false,
          balcony: false,
          listingUrl: fullUrl,
        });
      } catch (e) { continue; }
    }

    return listings;
  },
};
