const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Plataforma de Gestão Pedagógica — API",
      version: "1.0.0",
      description:
        "API REST da Plataforma de Gestão Pedagógica (UC00605 — Backend, UC00614 — Integração de Sistemas). " +
        "Todas as respostas seguem o formato { data: ... } em caso de sucesso, ou " +
        "{ error: { code, message, statusCode } } em caso de erro.",
    },
    servers: [{ url: "http://localhost:4000/api/v1" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Erro: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "VALIDATION_ERROR" },
                message: { type: "string" },
                statusCode: { type: "integer", example: 422 },
              },
            },
          },
        },
        Utilizador: {
          type: "object",
          properties: {
            id: { type: "integer" },
            nome: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["COORDENADOR", "FORMADOR"] },
            contacto: { type: "string", nullable: true },
            linkedin: { type: "string", nullable: true },
            competencias: { type: "string", nullable: true },
            sigla: { type: "string", nullable: true },
            turmasQtd: { type: "integer", nullable: true },
            ucsQtd: { type: "integer", nullable: true },
            estadoFormador: { type: "string", enum: ["ATIVO", "INATIVO"], nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Turma: {
          type: "object",
          properties: {
            id: { type: "integer" },
            codigo: { type: "string", example: "T-2026-A" },
            designacao: { type: "string" },
            dataInicio: { type: "string", format: "date" },
            numFormandos: { type: "integer" },
            estado: { type: "string", enum: ["PLANEADA", "EM_CURSO", "CONCLUIDA"] },
          },
        },
        Entrega: {
          type: "object",
          properties: {
            id: { type: "integer" },
            formadorId: { type: "integer" },
            turmaId: { type: "integer" },
            documento: { type: "string" },
            dataLimite: { type: "string", format: "date" },
            entregue: { type: "boolean" },
            submissaoTipo: { type: "string", enum: ["FICHEIRO", "EXCECAO", "COORDENACAO"], nullable: true },
            submissaoFicheiroUrl: { type: "string", nullable: true },
            submissaoNota: { type: "string", nullable: true },
            formador: { type: "object", properties: { id: { type: "integer" }, nome: { type: "string" }, sigla: { type: "string" } } },
            turma: { type: "object", properties: { id: { type: "integer" }, codigo: { type: "string" }, designacao: { type: "string" } } },
          },
        },
        PedidoAcesso: {
          type: "object",
          properties: {
            id: { type: "integer" },
            nome: { type: "string" },
            email: { type: "string", format: "email" },
            cargo: { type: "string" },
            motivo: { type: "string" },
            estado: { type: "string", enum: ["PENDENTE", "APROVADO", "REJEITADO"] },
          },
        },
      },
    },
  },
  apis: [path.join(__dirname, "..", "routes", "*.js").split(path.sep).join("/")],
});

module.exports = { swaggerSpec };
