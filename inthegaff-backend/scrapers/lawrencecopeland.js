// DISABLED: Lawrence Copeland lettings page returns 404
// Site may have removed their lettings section
module.exports = {
  id: 'lawrencecopeland',
  name: 'Lawrence Copeland',
  website: 'https://lawrencecopeland.com',
  areas: ['Salford Quays', 'Manchester City Centre', 'Castlefield'],
  async scrape() { return []; },
};
