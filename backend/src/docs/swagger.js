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
            role: { type: "string", enum: ["COORDENADOR", "FORMADOR", "FORMANDO"] },
            contacto: { type: "string", nullable: true },
            linkedin: { type: "string", nullable: true },
            competencias: { type: "string", nullable: true },
            sigla: { type: "string", nullable: true },
            turmasQtd: { type: "integer", nullable: true },
            ucsQtd: { type: "integer", nullable: true },
            estadoFormador: { type: "string", enum: ["ATIVO", "INATIVO"], nullable: true },
            turmaId: { type: "integer", nullable: true, description: "Só usado quando role=FORMANDO — a turma em que está inscrito." },
            turma: { type: "object", nullable: true, properties: { id: { type: "integer" }, codigo: { type: "string" }, designacao: { type: "string" } }, description: "Só presente em respostas que incluem a relação (ex.: GET /formandos)." },
            ativo: { type: "boolean", default: true, description: "false = conta desativada (soft delete) — mantém-se na base de dados mas não pode fazer login nem aparece nas listagens por omissão." },
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
            idCursoIEFP: { type: "string", nullable: true, example: "25.0422" },
            mediadorId: { type: "integer", nullable: true },
            mediador: { type: "object", nullable: true, properties: { id: { type: "integer" }, nome: { type: "string" }, sigla: { type: "string" } } },
            ativo: { type: "boolean", default: true, description: "false = turma desativada (soft delete)." },
          },
        },
        UC: {
          type: "object",
          description: "Catálogo de UCs, independente de turma.",
          properties: {
            id: { type: "integer" },
            abreviatura: { type: "string", example: "UC0004" },
            nome: { type: "string" },
            cargaHoraria: { type: "integer", example: 50 },
            ativo: { type: "boolean", default: true, description: "false = UC desativada no catálogo (soft delete)." },
          },
        },
        TurmaUC: {
          type: "object",
          description: "Associação de uma UC do catálogo a uma turma concreta, com o formador que a leciona nessa turma.",
          properties: {
            id: { type: "integer" },
            turmaId: { type: "integer" },
            ucId: { type: "integer" },
            formadorId: { type: "integer" },
            horasDadas: { type: "integer", example: 12 },
            horasEmFalta: { type: "integer", example: 38 },
            uc: { type: "object", properties: { id: { type: "integer" }, abreviatura: { type: "string" }, nome: { type: "string" }, cargaHoraria: { type: "integer" } } },
            formador: { type: "object", properties: { id: { type: "integer" }, nome: { type: "string" }, sigla: { type: "string" } } },
            turma: { type: "object", properties: { id: { type: "integer" }, codigo: { type: "string" }, designacao: { type: "string" } } },
            ativo: { type: "boolean", default: true, description: "false = associação removida da turma (soft delete) — não aceita novas aulas." },
          },
        },
        Disponibilidade: {
          type: "object",
          properties: {
            id: { type: "integer" },
            formadorId: { type: "integer" },
            data: { type: "string", format: "date" },
            horaInicio: { type: "integer", minimum: 0, maximum: 23 },
            estado: { type: "string", enum: ["LIVRE", "BLOQUEADO"] },
            motivo: { type: "string", nullable: true, example: "Almoço" },
          },
        },
        Aula: {
          type: "object",
          properties: {
            id: { type: "integer" },
            turmaUcId: { type: "integer" },
            disponibilidadeId: { type: "integer" },
            data: { type: "string", format: "date" },
            horaInicio: { type: "integer" },
            duracaoHoras: { type: "integer", default: 1 },
            modalidade: { type: "string", enum: ["PRESENCIAL", "ONLINE"] },
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
            ativo: { type: "boolean", default: true, description: "false = aviso desativado (soft delete)." },
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
            estado: {
              type: "string",
              enum: ["PENDENTE", "A_AGUARDAR_RH", "APROVADO", "REJEITADO"],
              description: "A_AGUARDAR_RH: já aprovado (papel/turma decididos), a aguardar que os RH criem a conta fora da plataforma. APROVADO: conta já criada.",
            },
            roleDecidido: { type: "string", enum: ["COORDENADOR", "FORMADOR", "FORMANDO"], nullable: true, description: "Preenchido a partir de A_AGUARDAR_RH." },
            turmaIdDecidido: { type: "integer", nullable: true },
            turmaDecidida: { type: "object", nullable: true, properties: { id: { type: "integer" }, codigo: { type: "string" }, designacao: { type: "string" } } },
          },
        },
      },
    },
  },
  apis: [path.join(__dirname, "..", "routes", "*.js").split(path.sep).join("/")],
});

module.exports = { swaggerSpec };
