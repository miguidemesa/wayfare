import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireTrip } from "@/lib/trip-access";
import { handle, json, rateLimit } from "@/lib/api-helpers";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
]);

function formStr(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

export async function GET(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    // Never return file contents here — metadata only. Sensitive docs are masked client-side.
    const documents = await db.documentFile.findMany({
      where: { tripId, trip: { userId: user.id } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        kind: true,
        content: true,
        mime: true,
        sizeBytes: true,
        sensitive: true,
        linkedType: true,
        linkedId: true,
        createdAt: true,
      },
    });
    return json({ documents });
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    if (!rateLimit(`upload:${user.id}`, 20, 60_000)) {
      return json({ error: "Upload rate limit reached — try again shortly" }, 429);
    }
    const { tripId } = await params;
    await requireTrip(tripId, user.id);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json({ error: "Invalid multipart form body" }, 400);
    }
    const kind = formStr(form, "kind") || "OTHER";
    const name = formStr(form, "name").trim();
    const sensitive = formStr(form, "sensitive") === "true";
    const noteContent = formStr(form, "content") || null;
    const file = form.get("file");

    let fileName: string | null = null;
    let mime: string | null = null;
    let sizeBytes: number | null = null;

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_SIZE) return json({ error: "File exceeds 10MB limit" }, 400);
      if (!ALLOWED_MIME.has(file.type)) {
        return json({ error: "Only PDF, PNG, JPEG, WEBP or TXT files are allowed" }, 400);
      }
      const ext =
        file.type === "application/pdf" ? "pdf"
        : file.type === "image/png" ? "png"
        : file.type === "image/webp" ? "webp"
        : file.type === "text/plain" ? "txt"
        : "jpg";
      fileName = `${crypto.randomUUID()}.${ext}`;
      await mkdir(UPLOAD_DIR, { recursive: true });
      const buf = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(UPLOAD_DIR, fileName), buf);
      mime = file.type;
      sizeBytes = file.size;
    }

    if (!fileName && !noteContent && !name) {
      return json({ error: "Provide a file or note content" }, 400);
    }

    const doc = await db.documentFile.create({
      data: {
        tripId,
        name: name || (file instanceof File ? file.name.replace(/\.[^.]+$/, "") : "Untitled"),
        kind,
        fileName,
        content: noteContent?.slice(0, 5000) || null,
        mime,
        sizeBytes,
        sensitive: !!sensitive || kind === "PASSPORT_NOTE",
      },
    });
    return json({ document: doc }, 201);
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "id required" }, 400);
    const doc = await db.documentFile.findFirst({
      where: { id, tripId, trip: { userId: user.id } },
    });
    if (!doc) return json({ error: "Not found" }, 404);
    if (doc.fileName) {
      await unlink(path.join(UPLOAD_DIR, path.basename(doc.fileName))).catch(() => {});
    }
    await db.documentFile.delete({ where: { id } });
    return json({ ok: true });
  });
}
