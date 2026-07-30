const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");

const { swaggerSpec } = require("./docs/swagger");
const { UPLOADS_DIR } = require("./config/paths");
const authRoutes = require("./routes/auth.routes");
const turmasRoutes = require("./routes/turmas.routes");
const formadoresRoutes = require("./routes/formadores.routes");
const entregasRoutes = require("./routes/entregas.routes");
const pedidosAcessoRoutes = require("./routes/pedidosAcesso.routes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5500" }));
app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/api/v1/health", (req, res) => res.json({ data: { status: "ok" } }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/turmas", turmasRoutes);
app.use("/api/v1/formadores", formadoresRoutes);
app.use("/api/v1/entregas", entregasRoutes);
app.use("/api/v1/pedidos-acesso", pedidosAcessoRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
