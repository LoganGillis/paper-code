-- Redefine Secret as per-space
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "Secret";
PRAGMA foreign_keys=on;

ALTER TABLE "Space" ADD COLUMN "secretsExposed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Secret" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "valueEnc" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "spaceId" TEXT NOT NULL,
    CONSTRAINT "Secret_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Secret_spaceId_key_key" ON "Secret"("spaceId", "key");
