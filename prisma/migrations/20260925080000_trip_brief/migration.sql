-- Planning interview answers (Trip.brief) and the traveller defaults they
-- leave behind (User.preferences). Both JSON strings; see src/lib/brief.ts.
ALTER TABLE "Trip" ADD COLUMN "brief" TEXT;
ALTER TABLE "User" ADD COLUMN "preferences" TEXT;
