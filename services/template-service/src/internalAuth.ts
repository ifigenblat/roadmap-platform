import type { RequestHandler } from "express";

export const requireInternalKey: RequestHandler = (req, res, next) => {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) {
    return next();
  }
  if (req.headers["x-internal-key"] !== expected) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};
