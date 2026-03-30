import type { RequestHandler } from "express";

/**
 * When the gateway forwards identity (`X-User-Id`), only `admin` may create workspaces.
 * If there is no gateway identity header (anonymous dev or JWT not enforced), allow (previous behavior).
 */
export const requireAdminForWorkspaceCreate: RequestHandler = (req, res, next) => {
  const uid = req.headers["x-user-id"];
  if (!uid || typeof uid !== "string") {
    return next();
  }
  const role = String(req.headers["x-user-role"] ?? "").toLowerCase();
  if (role === "admin") return next();
  return res.status(403).json({ message: "Admin role required to create workspaces" });
};
