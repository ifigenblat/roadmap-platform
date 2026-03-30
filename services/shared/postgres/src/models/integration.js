const { DataTypes } = require("sequelize");

/**
 * Sequelize models for the integration schema (tables created by Prisma migrations).
 * Keep column names aligned with Prisma / Postgres.
 */
function createIntegrationModels(sequelize) {
  const IntegrationConnection = sequelize.define(
    "IntegrationConnection",
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      workspaceId: { type: DataTypes.STRING, allowNull: false },
      provider: { type: DataTypes.STRING, allowNull: false },
      connectionName: { type: DataTypes.STRING, allowNull: false },
      configEncrypted: { type: DataTypes.TEXT, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false },
      lastSyncAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "svc_integration_connections",
      schema: "integration",
      underscored: false,
      timestamps: true,
    }
  );

  const ExternalLink = sequelize.define(
    "ExternalLink",
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      workspaceId: { type: DataTypes.STRING, allowNull: false },
      entityType: { type: DataTypes.STRING, allowNull: false },
      entityId: { type: DataTypes.STRING, allowNull: false },
      provider: { type: DataTypes.STRING, allowNull: false },
      externalId: { type: DataTypes.STRING, allowNull: false },
      externalUrl: { type: DataTypes.STRING, allowNull: false },
      syncState: { type: DataTypes.STRING, allowNull: false },
      metadataJson: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      tableName: "svc_integration_external_links",
      schema: "integration",
      underscored: false,
      timestamps: true,
    }
  );

  return { IntegrationConnection, ExternalLink };
}

module.exports = { createIntegrationModels };
