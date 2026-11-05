"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Alert, Badge, PageHeader } from "@/components/ui";

export default function DocumentPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/documents/${params.id}`).then(setData).catch((e) => setError(e.message));
  }, [params.id]);

  useEffect(() => {
    if (data && location.hash) document.querySelector(location.hash)?.scrollIntoView({ block: "center" });
  }, [data]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;
  const d = data.document;

  return (
    <div className="max-w-4xl">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-ink">← All notes</Link>
      <div className="mt-3">
        <PageHeader
          title={d.title}
          sub={`${d.folder_name} · ${d.file_type.toUpperCase()} · uploaded ${fmtDate(d.uploaded_at)}`}
          action={<div className="flex items-center gap-2"><Badge tone={d.status}>{d.status}</Badge><span className="text-sm text-slate-500">{d.chunk_count} chunks</span></div>}
        />
      </div>
      <ol className="space-y-3">
        {data.chunks.map((c: any) => (
          <li key={c.id} id={`chunk-${c.chunk_index}`} className="card scroll-mt-24 p-4 target:ring-2 target:ring-accent">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>Chunk {c.chunk_index + 1}</span>
              <span>{c.embedded ? "embedded · 384 dims" : "not embedded"}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{c.content}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
