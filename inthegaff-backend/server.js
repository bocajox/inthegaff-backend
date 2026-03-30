require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const { initDB } = require('./db');
const listingsRouter = require('./routes/listings');
const agentsRouter   = require('./routes/agents');
const statsRouter    = require('./routes/stats');
const { startScheduler } = require('./scheduler');

const app  = express();
const PORT = process.env.PORT || 3000;
process.on('uncaughtException', (err) => { console.error('💥 Uncaught Exception:', err.message, err.stack); });
process.on('unhandledRejection', (reason) => { console.error('💥 Unhandled Rejection:', reason); });
// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', app: 'InTheGaff API', version: '1.0.0' });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/listings', listingsRouter);
app.use('/api/agents',   agentsRouter);
app.use('/api/stats',    statsRouter);

// ── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  await initDB();
  app.listen(PORT, () => console.log(`🏠 InTheGaff API running on port ${PORT}`));

  // Start scraper scheduler (every 20 minutes)
  startScheduler();
})();
