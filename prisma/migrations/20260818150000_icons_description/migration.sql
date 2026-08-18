-- Space appearance
ALTER TABLE "Space" ADD COLUMN "iconColor" TEXT NOT NULL DEFAULT 'slate';
UPDATE "Space" SET icon = 'BookOpen';

-- Folder appearance
ALTER TABLE "Folder" ADD COLUMN "icon" TEXT NOT NULL DEFAULT 'Folder';
ALTER TABLE "Folder" ADD COLUMN "iconColor" TEXT NOT NULL DEFAULT 'slate';

-- Page appearance + instructions
ALTER TABLE "Page" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Page" ADD COLUMN "icon" TEXT NOT NULL DEFAULT 'FileText';
ALTER TABLE "Page" ADD COLUMN "iconColor" TEXT NOT NULL DEFAULT 'slate';
UPDATE "Page" SET icon = 'FileText', iconColor = 'slate' WHERE type = 'markdown';
UPDATE "Page" SET icon = 'FileCode', iconColor = 'peach' WHERE type = 'javascript';
UPDATE "Page" SET icon = 'FileCode2', iconColor = 'sky' WHERE type = 'typescript';
