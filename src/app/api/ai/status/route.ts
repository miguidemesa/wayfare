import { aiStatus } from "@/lib/ai/agent";
import { handle, json } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";

export async function GET() {
  return handle(async () => {
    await requireUser();
    // Deliberately exposes only provider id/model — never keys.
    return json(await aiStatus());
  });
}
