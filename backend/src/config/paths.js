const path = require("path");

// Em testes (NODE_ENV=test, definido automaticamente pelo Jest) usa-se uma
// pasta separada, para os testes nunca tocarem em ficheiros reais de dev.
const pastaUploads = process.env.NODE_ENV === "test" ? "uploads-test" : "uploads";

const UPLOADS_DIR = path.join(__dirname, "..", "..", pastaUploads);

module.exports = { UPLOADS_DIR };
