module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
  testTimeout: 15000,
  testPathIgnorePatterns: ["/node_modules/", "/uploads/"],
  // Os testes de integração partilham UMA base de dados de teste (MySQL) e cada
  // ficheiro faz limpeza global (deleteMany) no beforeEach. Com workers em paralelo,
  // um ficheiro pode apagar registos de que outro ainda depende a meio do teste —
  // dá erros aleatórios (unique constraint, "record not found", FK violation).
  // maxWorkers: 1 corre os ficheiros de teste em série, eliminando a corrida.
  maxWorkers: 1,
};
