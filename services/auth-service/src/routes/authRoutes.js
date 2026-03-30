const express = require("express");
const { z } = require("zod");
const rateLimit = require("express-rate-limit");
const AuthService = require("../services/authService.js");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
});

function getBearer(req) {
  const a = req.headers.authorization;
  if (!a?.startsWith("Bearer ")) return null;
  return a.slice(7);
}

async function requireAuthUser(req, res, next) {
  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const user = await AuthService.validateToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    req.authUser = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireAdmin(req, res, next) {
  if (req.authUser?.role?.name !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(200),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", registerLimiter, express.json(), async (req, res) => {
  const parsed = registerBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  try {
    const out = await AuthService.register(parsed.data);
    return res.status(201).json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error(e);
    return res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", loginLimiter, express.json(), async (req, res) => {
  const parsed = loginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const out = await AuthService.login(parsed.data);
  if (!out) return res.status(401).json({ error: "Invalid email or password" });
  return res.json(out);
});

router.get("/validate", requireAuthUser, async (req, res) => {
  return res.json({ valid: true, user: req.authUser });
});

router.get("/me", requireAuthUser, async (req, res) => {
  return res.json(req.authUser);
});

const profileBody = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
});

router.put("/profile", requireAuthUser, express.json(), async (req, res) => {
  const parsed = profileBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  try {
    const user = await AuthService.updateProfile(req.authUser.id, parsed.data);
    return res.json(user);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return res.status(409).json({ error: "Email already in use" });
    }
    console.error(e);
    return res.status(500).json({ error: "Update failed" });
  }
});

const passwordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.put("/password", requireAuthUser, express.json(), async (req, res) => {
  const parsed = passwordBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const ok = await AuthService.changePassword(req.authUser.id, parsed.data);
  if (!ok) return res.status(400).json({ error: "Current password is incorrect" });
  return res.json({ ok: true });
});

const forgotBody = z.object({
  email: z.string().email(),
});

router.post("/forgot-password", loginLimiter, express.json(), async (req, res) => {
  const parsed = forgotBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  await AuthService.requestPasswordReset(parsed.data.email);
  return res.json({ ok: true, message: "If an account exists, reset instructions were sent." });
});

const resetBody = z.object({
  token: z.string().min(32),
  newPassword: z.string().min(8),
});

router.post("/reset-password", loginLimiter, express.json(), async (req, res) => {
  const parsed = resetBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const ok = await AuthService.resetPasswordWithToken(parsed.data.token, parsed.data.newPassword);
  if (!ok) return res.status(400).json({ error: "Invalid or expired reset token" });
  return res.json({ ok: true });
});

router.get("/users", requireAuthUser, requireAdmin, async (_req, res) => {
  const users = await AuthService.listUsersForAdmin();
  return res.json(users);
});

module.exports = { router };
