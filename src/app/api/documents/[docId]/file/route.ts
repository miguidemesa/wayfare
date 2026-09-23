import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api-helpers";
import { readFile, stat } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

/** Authenticated document download — files are never publicly served. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const user = await requireUser();
    const { docId } = await params;
    const doc = await db.documentFile.findFirst({
      where: { id: docId, trip: { userId: user.id } },
    });
    if (!doc || !doc.fileName) {
      return new Response("Not found", { status: 404 });
    }
    // Path traversal guard
    const safeName = path.basename(doc.fileName);
    const filePath = path.join(UPLOAD_DIR, safeName);
    if (!filePath.startsWith(UPLOAD_DIR)) {
      return new Response("Forbidden", { status: 403 });
    }
    try {
      await stat(filePath);
    } catch {
      return new Response("File missing", { status: 410 });
    }
    const data = await readFile(filePath);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": doc.mime ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.name)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const status = e instanceof Error && e.message === "Not signed in" ? 401 : 500;
    return new Response("Error", { status });
  }
}
