// DISABLED: Purplebricks is a Next.js SPA — no server-rendered property listings
// HTML contains only __NEXT_DATA__ shell with no property content
// Cannot be scraped with cheerio — would need a headless browser
module.exports = {
  id: 'purplebricks',
  name: 'Purple Bricks',
  website: 'https://www.purplebricks.co.uk',
  areas: ['Manchester', 'Salford', 'Chorlton', 'Didsbury', 'Fallowfield'],
  async scrape() { return []; },
};
