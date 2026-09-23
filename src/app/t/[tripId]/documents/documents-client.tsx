"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  FileText,
  Lock,
  Plus,
  ScanLine,
  Trash2,
} from "lucide-react";
import type { TripBundle } from "@/lib/trip-service";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/client-api";

const KIND_LABEL: Record<string, string> = {
  PASSPORT_NOTE: "Passport note",
  FLIGHT: "Flight",
  HOTEL: "Hotel",
  RESTAURANT: "Restaurant",
  TOUR: "Tour",
  TICKET: "Ticket",
  INSURANCE: "Insurance",
  NOTE: "Note",
  OTHER: "Other",
};

export function DocumentsClient({ tripId, bundle }: { tripId: string; bundle: TripBundle }) {
  const router = useRouter();
  const { documents } = bundle;
  const [addOpen, setAddOpen] = useState(false);
  const [viewing, setViewing] = useState<typeof documents[0] | null>(null);
  const [reveal, setReveal] = useState<string | null>(null);

  async function deleteDoc(id: string) {
    try {
      await api(`/api/trips/${tripId}/documents?id=${id}`, { method: "DELETE" });
      router.refresh();
    } catch {}
  }

  async function downloadDoc(id: string, name: string) {
    try {
      const res = await fetch(`/api/documents/${id}/file`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {}
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-5 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Document vault</h1>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {documents.length} document{documents.length !== 1 ? "s" : ""} — sensitive items are blurred by default
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={15} /> Add document
        </Button>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          emoji="📁"
          title="No documents yet"
          description="Upload PDFs, photos, or create secure notes. Sensitive items (passports, insurance) are blurred until you reveal them."
          action={<Button onClick={() => setAddOpen(true)}><Plus size={15} /> Add your first document</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="overflow-hidden animate-fade-up">
              <div className="flex items-center gap-3 p-4">
                <div className={cn("grid h-12 w-12 place-items-center rounded-xl", doc.sensitive ? "bg-danger/15" : "bg-surface-2")}>
                  {doc.sensitive ? <Lock size={18} className="text-danger" /> : <FileText size={18} className="text-ink-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold truncate">{doc.name}</h3>
                    <Badge tone={doc.sensitive ? "danger" : "neutral"} className="shrink-0">
                      {KIND_LABEL[doc.kind] ?? doc.kind}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-3">
                    {doc.mime ?? "note"} {doc.sizeBytes ? `· ${(doc.sizeBytes / 1024).toFixed(1)} KB` : ""}
                    {doc.sensitive && <span className="ml-1.5 font-medium text-danger">● Private</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!doc.sensitive && doc.fileName && (
                    <Button variant="ghost" size="icon" onClick={() => downloadDoc(doc.id, doc.name)} aria-label="Download">
                      <Download size={15} />
                    </Button>
                  )}
                  {doc.content && (
                    <button
                      onClick={() => setViewing(doc)}
                      className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
                      aria-label="View note"
                    >
                      <Eye size={15} />
                    </button>
                  )}
                  {doc.sensitive && (
                    <button
                      onClick={() => setReveal(doc.id === reveal ? null : doc.id)}
                      className={cn(
                        "rounded-lg p-1.5 transition-colors",
                        reveal === doc.id ? "bg-danger/10 text-danger" : "text-ink-3 hover:bg-surface-2 hover:text-ink"
                      )}
                      aria-label={reveal === doc.id ? "Hide sensitive content" : "Reveal sensitive content"}
                    >
                      {reveal === doc.id ? <Eye size={15} /> : <Lock size={15} />}
                    </button>
                  )}
                  <Button variant="danger" size="icon" onClick={() => deleteDoc(doc.id)}>
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
              {(reveal === doc.id || doc.content) && (
                <div className={cn("border-t border-line px-4 py-3", doc.sensitive ? "bg-danger/5" : "bg-surface-2/50")}>
                  <pre className="whitespace-pre-wrap text-[13px] leading-relaxed">{doc.content}</pre>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <AddDocModal open={addOpen} onClose={() => setAddOpen(false)} tripId={tripId} onSaved={() => router.refresh()} />
      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={viewing.name} wide>
          <pre className="whitespace-pre-wrap text-[13px] leading-relaxed">{viewing.content}</pre>
        </Modal>
      )}
    </div>
  );
}

function AddDocModal({ open, onClose, tripId, onSaved }: { open: boolean; onClose: () => void; tripId: string; onSaved: () => void }) {
  const [tab, setTab] = useState<"file" | "note">("file");
  const [kind, setKind] = useState("OTHER");
  const [name, setName] = useState("");
  const [sensitive, setSensitive] = useState(false);
  const [content, setContent] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      fd.append("name", name || file.name.replace(/\.[^.]+$/, ""));
      fd.append("sensitive", String(sensitive));
      const res = await fetch(`/api/trips/${tripId}/documents`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      onClose();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveNote() {
    setUploading(true);
    setError(null);
    try {
      await api(`/api/trips/${tripId}/documents`, {
        json: { kind, name: name.trim() || "Untitled note", content: content.trim(), sensitive, fileName: null, mime: "text/plain", sizeBytes: new Blob([content]).size },
      });
      onClose();
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add to vault" wide>
      <div className="mb-4 flex gap-1 rounded-xl bg-surface-2 p-1">
        {(["file", "note"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
              tab === t ? "border border-line bg-surface shadow-sm" : "text-ink-3 hover:text-ink"
            )}
          >
            {t === "file" ? "📎 Upload file" : "📝 Secure note"}
          </button>
        ))}
      </div>

      <Field label="Type">
        <Select value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Travel insurance policy" /></Field>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="sensitive" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} className="rounded border-line accent-accent" />
        <label htmlFor="sensitive" className="text-[13px] text-ink-2 cursor-pointer">
          Mark as sensitive (blurs content until explicitly revealed)
        </label>
      </div>

      {tab === "file" ? (
        <>
          <div className="relative">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-surface-2/50 px-6 py-10 transition-colors hover:border-accent/50 hover:bg-accent-soft/20 disabled:opacity-60"
            >
              {uploading ? <Spinner className="h-6 w-6 text-accent" /> : <ScanLine size={26} className="text-ink-3" />}
              <span className="text-sm font-medium">Click or drop a file (PDF, JPG, PNG, WEBP, TXT)</span>
              <span className="text-xs text-ink-3">Max 10 MB · sensitive items are encrypted at rest</span>
            </button>
            <input ref={fileRef} type="file" accept=".pdf,image/png,image/jpeg,image/webp,text/plain" hidden onChange={handleFile} />
          </div>
          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}
          <Button onClick={() => fileRef.current?.click()} loading={uploading} className="w-full">Upload & save</Button>
        </>
      ) : (
        <>
          <Field label="Content"><Textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Passport numbers, insurance details, confirmation codes…" /></Field>
          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}
          <Button onClick={saveNote} loading={uploading} className="w-full">Save note</Button>
        </>
      )}
    </Modal>
  );
}