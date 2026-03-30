// DISABLED: Reeds Rains uses AJAX search form — property results loaded via API, not in HTML
// Cannot be scraped with cheerio — would need a headless browser
module.exports = {
  id: 'reedsrains',
  name: 'Reeds Rains',
  website: 'https://www.reedsrains.co.uk',
  areas: ['Didsbury', 'Chorlton', 'Sale', 'Manchester City Centre'],
  async scrape() { return []; },
};
