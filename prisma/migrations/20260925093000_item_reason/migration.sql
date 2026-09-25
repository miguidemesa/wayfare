-- Why the planner picked a stop, shown in the plan preview and on the stop.
ALTER TABLE "ItineraryItem" ADD COLUMN "reason" TEXT;
