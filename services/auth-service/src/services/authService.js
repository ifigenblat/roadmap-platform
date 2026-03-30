const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createHash, randomBytes } = require("node:crypto");
const { prisma } = require("../db.js");

function getJwtSecret() {
  const s = process.env.JWT_SECRET?.trim();
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
}

function formatUserForJWT(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
    role: {
      id: user.role.id,
      name: user.role.name,
      displayName: user.role.displayName,
      permissions: user.role.permissions ?? {},
    },
  };
}

function generateToken(userRecord) {
  const payload = {
    id: userRecord.id,
    name: userRecord.name,
    email: userRecord.email,
    role: {
      id: userRecord.role.id,
      name: userRecord.role.name,
      displayName: userRecord.role.displayName,
      permissions: userRecord.role.permissions ?? {},
    },
    mustChangePassword: userRecord.mustChangePassword,
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

async function validateToken(token) {
  const decoded = jwt.verify(token, getJwtSecret());
  const id = decoded.id;
  if (!id || typeof id !== "string") return null;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!user || user.disabled) return null;
  return formatUserForJWT(user);
}

async function register({ email, password, name }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const roleUser = await prisma.role.findUnique({ where: { name: "user" } });
  if (!roleUser) throw new Error("Roles not seeded");
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(String(password), salt);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: String(name).trim(),
      passwordHash,
      roleId: roleUser.id,
    },
    include: { role: true },
  });
  const token = generateToken(user);
  return { token, user: formatUserForJWT(user) };
}

async function login({ email, password }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { role: true },
  });
  if (!user || user.disabled) return null;
  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return null;
  const token = generateToken(user);
  return { token, user: formatUserForJWT(user) };
}

async function loadUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!user || user.disabled) return null;
  return formatUserForJWT(user);
}

async function updateProfile(userId, { name, email }) {
  const data = {};
  if (name !== undefined) data.name = String(name).trim();
  if (email !== undefined) data.email = String(email).trim().toLowerCase();
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    include: { role: true },
  });
  return formatUserForJWT(user);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!ok) return false;
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(String(newPassword), salt);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
  return true;
}

async function requestPasswordReset(email) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.disabled) {
    return { ok: true };
  }
  const raw = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });
  return { ok: true, rawToken: raw, email: normalizedEmail };
}

async function resetPasswordWithToken(rawToken, newPassword) {
  if (!rawToken || String(rawToken).length < 32) return false;
  const tokenHash = createHash("sha256").update(String(rawToken)).digest("hex");
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.expiresAt < new Date() || row.user.disabled) return false;
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(String(newPassword), salt);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.passwordResetToken.delete({ where: { id: row.id } }),
  ]);
  return true;
}

async function listUsersForAdmin() {
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    include: { role: true },
  });
  return users.map(formatUserForJWT);
}

module.exports = {
  formatUserForJWT,
  generateToken,
  validateToken,
  register,
  login,
  loadUserById,
  updateProfile,
  changePassword,
  requestPasswordReset,
  resetPasswordWithToken,
  listUsersForAdmin,
};
