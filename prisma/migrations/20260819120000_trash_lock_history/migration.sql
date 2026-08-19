-- AlterTable
ALTER TABLE "Page" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Page" ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Page" ADD COLUMN "spellcheck" BOOLEAN NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "PageVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageId" TEXT NOT NULL,
    CONSTRAINT "PageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "language" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "logs" TEXT NOT NULL DEFAULT '[]',
    "result" TEXT,
    "error" TEXT,
    "inputs" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageId" TEXT NOT NULL,
    CONSTRAINT "RunRecord_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PageVersion_pageId_createdAt_idx" ON "PageVersion"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "RunRecord_pageId_createdAt_idx" ON "RunRecord"("pageId", "createdAt");
