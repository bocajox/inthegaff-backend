const express = require("express");
const cors = require("cors");
const { pool } = require("./db");
const listingsRouter = require("./routes/listings");
const statsRouter = require("./routes/stats");
const agentsRouter = require("./routes/agents");
const { runAll } = require("./scheduler");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/listings", listingsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/agents", agentsRouter);

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
  console.log(`Server running on port ${PORT}`);
  setTimeout(() => runAll(), 2 * 60 * 1000);
  setInterval(() => runAll(), 20 * 60 * 1000);
});
