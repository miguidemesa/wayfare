-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Traveler" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "colorKey" TEXT NOT NULL DEFAULT 'teal',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Traveler_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Traveler" ("colorKey", "email", "id", "isOwner", "name", "tripId") SELECT "colorKey", "email", "id", "isOwner", "name", "tripId" FROM "Traveler";
DROP TABLE "Traveler";
ALTER TABLE "new_Traveler" RENAME TO "Traveler";
CREATE INDEX "Traveler_tripId_idx" ON "Traveler"("tripId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
