const { registerSchema, loginSchema } = require("../../src/controllers/auth.controller");
const { turmaSchema } = require("../../src/controllers/turmas.controller");

describe("registerSchema (validação, unitário)", () => {
  test("aceita dados válidos", () => {
    const resultado = registerSchema.safeParse({
      nome: "Ana Silva",
      email: "ana@escola.pt",
      password: "Segredo123",
      role: "FORMADOR",
    });
    expect(resultado.success).toBe(true);
  });

  test.each([
    ["nome com 1 carácter", { nome: "A", email: "a@a.pt", password: "123456", role: "FORMADOR" }],
    ["email inválido", { nome: "Ana", email: "nao-e-email", password: "123456", role: "FORMADOR" }],
    ["password curta", { nome: "Ana", email: "a@a.pt", password: "123", role: "FORMADOR" }],
    ["role inválido", { nome: "Ana", email: "a@a.pt", password: "123456", role: "ADMIN" }],
  ])("rejeita %s", (_descricao, dados) => {
    const resultado = registerSchema.safeParse(dados);
    expect(resultado.success).toBe(false);
  });
});

describe("loginSchema (validação, unitário)", () => {
  test("aceita email e password preenchidos", () => {
    expect(loginSchema.safeParse({ email: "a@a.pt", password: "x" }).success).toBe(true);
  });

  test("rejeita sem password", () => {
    expect(loginSchema.safeParse({ email: "a@a.pt", password: "" }).success).toBe(false);
  });
});

describe("turmaSchema (validação, unitário)", () => {
  test("aplica omissões por defeito (numFormandos=20, estado=PLANEADA)", () => {
    const resultado = turmaSchema.parse({
      codigo: "T-2026-A",
      designacao: "Programação Web",
      dataInicio: "2026-09-01",
    });
    expect(resultado.numFormandos).toBe(20);
    expect(resultado.estado).toBe("PLANEADA");
    expect(resultado.dataInicio).toBeInstanceOf(Date);
  });

  test("rejeita numFormandos negativo", () => {
    const resultado = turmaSchema.safeParse({
      codigo: "T-2026-A",
      designacao: "Programação Web",
      dataInicio: "2026-09-01",
      numFormandos: -5,
    });
    expect(resultado.success).toBe(false);
  });
});
