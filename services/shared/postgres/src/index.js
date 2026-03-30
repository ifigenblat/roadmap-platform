const { Sequelize } = require("sequelize");
const { createIntegrationModels } = require("./models/integration.js");

let sequelizeIntegration = null;
/** @type {ReturnType<createIntegrationModels> | null} */
let integrationModels = null;

/**
 * Connect to INTEGRATION_DATABASE_URL and register integration-schema models.
 * Portfolio / template data remain on Prisma until migrated to Sequelize (see spec).
 */
async function initPostgres() {
  const url = process.env.INTEGRATION_DATABASE_URL;
  if (!url) {
    throw new Error("INTEGRATION_DATABASE_URL is required for integration Sequelize models");
  }
  sequelizeIntegration = new Sequelize(url, {
    dialect: "postgres",
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  });
  await sequelizeIntegration.authenticate();
  integrationModels = createIntegrationModels(sequelizeIntegration);
  return { sequelize: sequelizeIntegration, models: integrationModels };
}

function getIntegrationModels() {
  if (!integrationModels) {
    throw new Error("initPostgres() must be called before getIntegrationModels()");
  }
  return integrationModels;
}

function getIntegrationSequelize() {
  if (!sequelizeIntegration) {
    throw new Error("initPostgres() must be called before getIntegrationSequelize()");
  }
  return sequelizeIntegration;
}

module.exports = {
  initPostgres,
  getIntegrationModels,
  getIntegrationSequelize,
  createIntegrationModels,
};

