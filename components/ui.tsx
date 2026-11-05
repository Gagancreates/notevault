import React from "react";

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

const tones: Record<string, string> = {
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  admin: "bg-accent-soft text-accent ring-accent/30",
  user: "bg-slate-100 text-slate-600 ring-slate-200",
  semantic: "bg-violet-50 text-violet-700 ring-violet-200",
  keyword: "bg-sky-50 text-sky-700 ring-sky-200",
  hybrid: "bg-accent-soft text-accent ring-accent/30",
  default: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        tones[tone || "default"] || tones.default
      }`}
    >
      {children}
    </span>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "ok"; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className={`rounded-lg px-3 py-2 text-sm ${
        kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="font-medium">{title}</div>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

/** Renders ts_headline output whose matches are wrapped in ⟦ ⟧, without using innerHTML. */
export function Highlight({ text }: { text: string }) {
  const parts = text.split(/(⟦[^⟧]*⟧)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("⟦") ? <mark key={i}>{p.slice(1, -1)}</mark> : <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </>
  );
}
