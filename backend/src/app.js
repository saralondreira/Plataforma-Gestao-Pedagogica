const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");

const { swaggerSpec } = require("./docs/swagger");
const authRoutes = require("./routes/auth.routes");
const turmasRoutes = require("./routes/turmas.routes");
const formadoresRoutes = require("./routes/formadores.routes");
const formandosRoutes = require("./routes/formandos.routes");
const entregasRoutes = require("./routes/entregas.routes");
const pedidosAcessoRoutes = require("./routes/pedidosAcesso.routes");
const ucRoutes = require("./routes/uc.routes");
const turmaUcRoutes = require("./routes/turmaUc.routes");
const disponibilidadeRoutes = require("./routes/disponibilidade.routes");
const aulaRoutes = require("./routes/aula.routes");
const notasRoutes = require("./routes/notas.routes");
const assiduidadeRoutes = require("./routes/assiduidade.routes");
const trabalhosRoutes = require("./routes/trabalhos.routes");
const mensagensRoutes = require("./routes/mensagens.routes");
const painelRoutes = require("./routes/painel.routes");
const calendarioRoutes = require("./routes/calendario.routes");
const pesquisaRoutes = require("./routes/pesquisa.routes");
const sumariosRoutes = require("./routes/sumarios.routes");
const documentosRoutes = require("./routes/documentos.routes");
const comunicadosRoutes = require("./routes/comunicados.routes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

// credentials: o browser envia o cookie httpOnly da sessão; por isso a origem tem de ser uma só (nunca "*").
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5500", credentials: true }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});
app.use(express.json());
// Sem express.static em /uploads: os ficheiros só saem por GET /api/v1/entregas/:id/ficheiro (autenticado).

app.get("/api/v1/health", (req, res) => res.json({ data: { status: "ok" } }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/turmas", turmasRoutes);
app.use("/api/v1/formadores", formadoresRoutes);
app.use("/api/v1/formandos", formandosRoutes);
app.use("/api/v1/entregas", entregasRoutes);
app.use("/api/v1/pedidos-acesso", pedidosAcessoRoutes);
app.use("/api/v1/ucs", ucRoutes);
app.use("/api/v1/turma-ucs", turmaUcRoutes);
app.use("/api/v1/disponibilidade", disponibilidadeRoutes);
app.use("/api/v1/aulas", aulaRoutes);
app.use("/api/v1/notas", notasRoutes);
app.use("/api/v1/assiduidade", assiduidadeRoutes);
app.use("/api/v1/trabalhos", trabalhosRoutes);
app.use("/api/v1/mensagens", mensagensRoutes);
app.use("/api/v1/painel", painelRoutes);
app.use("/api/v1/calendario", calendarioRoutes);
app.use("/api/v1/pesquisa", pesquisaRoutes);
app.use("/api/v1/sumarios", sumariosRoutes);
app.use("/api/v1/documentos", documentosRoutes);
app.use("/api/v1/comunicados", comunicadosRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
