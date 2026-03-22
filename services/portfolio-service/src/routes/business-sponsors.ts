import { Router } from "express";
import {
  createBusinessSponsorSchema,
  patchBusinessSponsorSchema,
} from "@roadmap/types";
import { getDefaultWorkspaceId, prisma } from "../db.js";
import { workspaceIdFromQuery } from "../workspace-guards.js";

export const businessSponsorsRouter = Router();

businessSponsorsRouter.get("/business-sponsors", async (req, res) => {
  const ws = workspaceIdFromQuery(req);
  res.json(
    await prisma.businessSponsor.findMany({
      where: ws ? { workspaceId: ws } : undefined,
      orderBy: { displayName: "asc" },
    })
  );
});

businessSponsorsRouter.post("/business-sponsors", async (req, res) => {
  const parsed = createBusinessSponsorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const workspaceId =
    typeof req.body.workspaceId === "string" && req.body.workspaceId.length > 0
      ? req.body.workspaceId
      : await getDefaultWorkspaceId();
  res.status(201).json(
    await prisma.businessSponsor.create({
      data: { ...parsed.data, workspaceId },
    })
  );
});

businessSponsorsRouter.get("/business-sponsors/:id", async (req, res) => {
  const row = await prisma.businessSponsor.findUnique({
    where: { id: req.params.id },
    include: {
      initiatives: {
        select: {
          id: true,
          canonicalName: true,
        },
      },
    },
  });
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
});

businessSponsorsRouter.patch("/business-sponsors/:id", async (req, res) => {
  const parsed = patchBusinessSponsorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const existing = await prisma.businessSponsor.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) return res.status(404).json({ message: "Not found" });
  res.json(
    await prisma.businessSponsor.update({
      where: { id: req.params.id },
      data: parsed.data,
    })
  );
});

businessSponsorsRouter.delete("/business-sponsors/:id", async (req, res) => {
  const initiativeCount = await prisma.initiative.count({
    where: { businessSponsorId: req.params.id },
  });
  if (initiativeCount > 0) {
    return res.status(409).json({
      message: "Sponsor is linked to initiatives; clear businessSponsorId first.",
      initiativeCount,
    });
  }
  const existing = await prisma.businessSponsor.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) return res.status(404).json({ message: "Not found" });
  await prisma.businessSponsor.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
