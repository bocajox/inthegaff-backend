require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { fork } = require('child_process');
const { initDB } = require('./db');
const listingsRouter = require('./routes/listings');
const agentsRouter   = require('./routes/agents');
const statsRouter    = require('./routes/stats');

const app  = express();
const PORT = process.env.PORT || 3000;

process.on('uncaughtException',  (err) => console.error('💥 Uncaught Exception:', err.message, err.stack));
process.on('unhandledRejection', (reason) => console.error('💥 Unhandled Rejection:', reason));

app.use(cors());
app.use(express.json());
app.get('/', (req, res) => res.json({ status: 'ok', app: 'InTheGaff API', version: '1.0.0' }));
app.use('/api/listings', listingsRouter);
app.use('/api/agents',   agentsRouter);
app.use('/api/stats',    statsRouter);

let scraperRunning = false;

function runScrapers() {
  if (scraperRunning) {
    console.log('⏭  Scraper already running — skipping this cycle');
    return;
  }
  scraperRunning = true;
  console.log('🔄 Launching scraper subprocess…');
  const child = fork(path.join(__dirname, 'scheduler.js'), [], { env: process.env });
  child.on('exit',  (code) => { console.log(`✅ Scraper done (exit ${code})`); scraperRunning = false; });
  child.on('error', (err)  => { console.error('💥 Scraper error:', err.message); scraperRunning = false; });
}

(async () => {
  await initDB();
  app.listen(PORT, () => console.log(`🏠 InTheGaff API running on port ${PORT}`));

  // First scrape 2 minutes after boot, then every 20 minutes
  setTimeout(() => {
    runScrapers();
    setInterval(runScrapers, 20 * 60 * 1000);
  }, 2 * 60 * 1000);

  console.log('⏱  First scrape in 2 min, then every 20 min — isolated subprocess');
})();
