// DISABLED: Bridgfords uses a React SPA with hash routing (/#/)
// Cannot be scraped with cheerio — would need a headless browser
module.exports = {
  id: 'bridgfords',
  name: 'Bridgfords',
  website: 'https://www.bridgfords.co.uk',
  areas: ['Chorlton', 'Levenshulme', 'Manchester City Centre', 'Salford'],
  async scrape() { return []; },
};
