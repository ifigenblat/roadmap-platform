-- Teams are global; workspace scoping is removed.

ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_workspaceId_fkey";

ALTER TABLE "Team" DROP COLUMN IF EXISTS "workspaceId";
