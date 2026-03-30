// DISABLED: Martin & Co uses a JavaScript-driven search with no SSR property results
// Cannot be scraped with cheerio — would need a headless browser
module.exports = {
  id: 'martinco',
  name: 'Martin & Co',
  website: 'https://www.martinco.com',
  areas: ['Chorlton', 'Fallowfield', 'Withington', 'Manchester City Centre'],
  async scrape() { return []; },
};
