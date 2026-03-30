const bcrypt = require("bcryptjs");
const { prisma } = require("./db.js");

async function seedRoles() {
  await prisma.role.upsert({
    where: { name: "user" },
    create: {
      name: "user",
      displayName: "User",
      permissions: {},
    },
    update: {},
  });
  await prisma.role.upsert({
    where: { name: "admin" },
    create: {
      name: "admin",
      displayName: "Administrator",
      permissions: { all: true },
    },
    update: {},
  });
}

async function maybeBootstrapAdmin() {
  const email = process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  const adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
  if (!adminRole) throw new Error("admin role missing");

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(String(password), salt);
  await prisma.user.create({
    data: {
      email,
      name: process.env.AUTH_BOOTSTRAP_ADMIN_NAME?.trim() || "Administrator",
      passwordHash,
      roleId: adminRole.id,
    },
  });
  console.log(`[auth-service] Bootstrap admin created: ${email}`);
}

async function runSeed() {
  await seedRoles();
  await maybeBootstrapAdmin();
}

module.exports = { runSeed, seedRoles, maybeBootstrapAdmin };
