const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.philipjames.co.uk';

module.exports = {
  id: 'philipjames',
  name: 'Philip James',
  website: BASE,
  areas: ['Didsbury', 'Chorlton', 'Fallowfield', 'Withington', 'Manchester City Centre'],

  async scrape() {
    const listings = [];
    const seen = new Set();

    // Primary lettings search URL — confirmed working as of April 2026
    const startUrl = `${BASE}/property-search/?department=residential-lettings`;

    let page = 1;

    while (page <= 10) {
      const url = page === 1
        ? startUrl
        : `${BASE}/property-search/page/${page}/?department=residential-lettings`;

      let $;
      try {
        $ = await fetchHTML(url);
      } catch (e) {
        break;
      }

      // Each listing is an <li> inside the results list
      // Use broad li selector then filter to only cards with a property-to-rent link
      const cards = $('li').filter((i, el) => {
        return $(el).find('a[href*="/property-to-rent/"]').length > 0;
      }).toArray();

      if (!cards.length) break;

      for (const card of cards) {
        try {
          const el = $(card);

          // Skip promo/advert cards (e.g. "Have you considered purchasing...")
          const cardText = el.text();
          if (/have you considered|buy-to-let|advertisement/i.test(cardText)) continue;

          // Link — uses /property-to-rent/ path
          const link = el.find('a[href*="/property-to-rent/"]').first();
          const href = link.attr('href') || '';
          if (!href) continue;

          const fullUrl = href.startsWith('http') ? href : BASE + href;
          if (seen.has(fullUrl)) continue;
          seen.add(fullUrl);

          // External ID from URL slug or REF text
          const refMatch = cardText.match(/REF:\s*(\S+)/i);
          const extId = refMatch
            ? refMatch[1]
            : href.replace(/\/$/, '').split('/').pop() || href;

          // Price is in an <h4> tag, e.g. "£3,500 pcm"
          // Do NOT use [class*="price"] — that matches <span class="price-qualifier"> which has no price
          const priceText = el.find('h4').filter((i, h4) => {
            return /£/.test($(h4).text());
          }).first().text().trim();
          const price = parsePrice(priceText);
          if (!price || price > 15000) continue;

          // Weekly-to-monthly conversion
          let finalPrice = price;
          if (/pw|per\s*week|weekly/i.test(priceText)) {
            finalPrice = Math.round(price * 52 / 12);
          }

          // Address is in <h3> — may contain a link
          const address = el.find('h3').first().text().trim();

          // Beds — look for text like "5 Bedrooms" in the card
          const bedsMatch = cardText.match(/(\d+)\s*Bedroom/i);
          const beds = bedsMatch ? parseInt(bedsMatch[1]) : parseBeds(address);

          // Image — use extractImage from helpers for lazy-load handling
          const imgSrc = extractImage(el.find('img').first());

          const postcode = extractPostcode(address);
          const area = guessArea(address, postcode);
          const desc = el.find('p').first().text().trim();

          listings.push({
            externalId: extId,
            title: address || `${beds} Bed, ${area}`,
            price: finalPrice,
            beds,
            type: parseType(address + ' ' + desc),
            area,
            street: address,
            postcode,
            description: desc,
            photos: imgSrc ? [imgSrc] : [],
            features: [],
            furnished: hasFeature(cardText, ['furnished']),
            parking: hasFeature(cardText, ['parking', 'garage']),
            pets: hasFeature(cardText, ['pets']),
            garden: hasFeature(cardText, ['garden']),
            balcony: hasFeature(cardText, ['balcony', 'terrace']),
            listingUrl: fullUrl,
          });
        } catch (e) {
          continue;
        }
      }

      // Pagination: look for a link to the next page
      const hasNext = $(`a[href*="page/${page + 1}/"]`).length > 0;
      if (!hasNext) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
