const express = require("express");
const cors = require("cors");
const { pool } = require("./db");
const listingsRouter = require("./routes/listings");
const { runAll } = require("./scheduler");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/listings", listingsRouter);

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    const mem = process.memoryUsage();
    res.json({
      status: "ok",
      version: "2.0.0",
      heapMB: Math.round(mem.heapUsed / 1048576),
      rssMB: Math.round(mem.rss / 1048576),
    });
  } catch (e) {
    res.status(500).json({ status: "db_error", message: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[server] v2.0.0 listening on ${PORT}`);

  let scraperRunning = false;

  const runScrapers = async () => {
    if (scraperRunning) {
      console.log("[server] scraper already running, skipping");
      return;
    }
    scraperRunning = true;
    try {
            await runAll();
    } catch (e) {
      console.error("[server] scraper error:", e.message);
    } finally {
      scraperRunning = false;
    }
  };

  setTimeout(runScrapers, 2 * 60 * 1000);
  setInterval(runScrapers, 20 * 60 * 1000);
});
