require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const turmasRoutes = require("./routes/turmas.routes");
const formadoresRoutes = require("./routes/formadores.routes");
const entregasRoutes = require("./routes/entregas.routes");
const pedidosAcessoRoutes = require("./routes/pedidosAcesso.routes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5500" }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/v1/health", (req, res) => res.json({ data: { status: "ok" } }));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/turmas", turmasRoutes);
app.use("/api/v1/formadores", formadoresRoutes);
app.use("/api/v1/entregas", entregasRoutes);
app.use("/api/v1/pedidos-acesso", pedidosAcessoRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API a correr em http://localhost:${PORT}`);
});
