import type { RequestHandler } from "express";

export const requireInternalKey: RequestHandler = (req, res, next) => {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) {
    return next();
  }
  const got = req.headers["x-internal-key"];
  if (got !== expected) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};
