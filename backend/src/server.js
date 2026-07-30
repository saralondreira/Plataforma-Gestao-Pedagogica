require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const turmasRoutes = require("./routes/turmas.routes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5500" }));
app.use(express.json());

app.get("/api/v1/health", (req, res) => res.json({ data: { status: "ok" } }));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/turmas", turmasRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API a correr em http://localhost:${PORT}`);
});
