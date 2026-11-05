"use client";
import { useCallback, useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Alert, Badge, Empty, PageHeader, Stat } from "@/components/ui";

export default function Admin() {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [s, u, m] = await Promise.all([api("/api/admin/stats"), api("/api/admin/users"), api("/api/me")]);
    setStats(s); setUsers(u.users); setMe(m.user);
  }, []);
  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  const run = (fn: () => Promise<any>) => fn().then(load).catch((e) => setError(e.message));

  if (!stats) return error ? <Alert>{error}</Alert> : <p className="text-sm text-slate-500">Loading…</p>;
  const t = stats.totals;

  return (
    <div>
      <PageHeader title="Admin" sub="Accounts, corpus size and search activity across NoteVault." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Users" value={t.users} />
        <Stat label="Documents" value={t.documents} />
        <Stat label="Chunks" value={t.chunks} />
        <Stat label="Searches" value={t.searches} />
      </div>
      <div className="mb-4"><Alert>{error}</Alert></div>

      <section className="card mb-6 overflow-hidden">
        <h2 className="border-b border-slate-100 px-4 py-3 font-medium">Users and corpus <span className="text-xs font-normal text-slate-400">· view user_corpus_stats</span></h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50"><tr><th className="th">User</th><th className="th">Role</th><th className="th">Documents</th><th className="th">Ready</th><th className="th">Chunks</th><th className="th">Last upload</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {stats.corpus.map((c: any) => {
                const self = me?.id === c.user_id;
                return (
                  <tr key={c.user_id}>
                    <td className="td"><div className="font-medium">{c.name}{self && <span className="ml-1 text-xs text-slate-400">(you)</span>}</div><div className="text-xs text-slate-500">{c.email}</div></td>
                    <td className="td">
                      <select className="input w-auto py-1 text-xs" value={c.role} disabled={self} aria-label={`Role for ${c.name}`}
                        onChange={(e) => run(() => api(`/api/admin/users/${c.user_id}`, { method: "PATCH", json: { role: e.target.value } }))}>
                        <option value="user">user</option><option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="td tabular-nums">{c.documents}</td>
                    <td className="td tabular-nums">{c.ready_documents}</td>
                    <td className="td tabular-nums">{c.chunks}</td>
                    <td className="td text-slate-500">{c.last_upload ? fmtDate(c.last_upload) : "—"}</td>
                    <td className="td text-right">
                      {!self && <button className="text-xs text-red-600 hover:underline"
                        onClick={() => confirm(`Delete ${c.name} and all their notes?`) && run(() => api(`/api/admin/users/${c.user_id}`, { method: "DELETE" }))}>Delete</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-4 py-3 font-medium">Popular searches <span className="text-xs font-normal text-slate-400">· GROUP BY … HAVING COUNT(*) ≥ 2</span></h2>
          {stats.popular.length === 0 ? <Empty title="No repeated searches yet" /> : (
            <table className="w-full"><thead className="bg-slate-50"><tr><th className="th">Query</th><th className="th">Times</th><th className="th">Avg results</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{stats.popular.map((p: any) => (
                <tr key={p.query}><td className="td">{p.query}</td><td className="td tabular-nums">{p.times_searched}</td><td className="td tabular-nums">{p.avg_results}</td></tr>))}
              </tbody></table>)}
        </section>
        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-4 py-3 font-medium">Searches by mode</h2>
          {stats.byMode.length === 0 ? <Empty title="No searches yet" /> : (
            <table className="w-full"><thead className="bg-slate-50"><tr><th className="th">Mode</th><th className="th">Searches</th><th className="th">Avg results</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{stats.byMode.map((m: any) => (
                <tr key={m.mode}><td className="td"><Badge tone={m.mode}>{m.mode}</Badge></td><td className="td tabular-nums">{m.searches}</td><td className="td tabular-nums">{m.avg_results}</td></tr>))}
              </tbody></table>)}
          <h3 className="border-y border-slate-100 px-4 py-2 text-sm font-medium">Above-average searchers <span className="text-xs font-normal text-slate-400">· subquery</span></h3>
          {stats.power.length === 0 ? <p className="px-4 py-3 text-sm text-slate-500">Nobody yet.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">{stats.power.map((p: any) => (
              <li key={p.email} className="flex justify-between px-4 py-2"><span>{p.name}</span><span className="tabular-nums text-slate-500">{p.searches}</span></li>))}</ul>)}
        </section>
      </div>

      <section className="card mt-6 overflow-hidden">
        <h2 className="border-b border-slate-100 px-4 py-3 font-medium">Recent activity</h2>
        {stats.recent.length === 0 ? <Empty title="No searches yet" /> : (
          <ul className="divide-y divide-slate-100 text-sm">{stats.recent.map((r: any, i: number) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span><span className="font-medium">{r.name}</span> searched “{r.query_text}”</span>
              <span className="flex items-center gap-2 text-xs text-slate-500"><Badge tone={r.mode}>{r.mode}</Badge>{r.result_count} result{r.result_count === 1 ? "" : "s"} · {fmtDate(r.created_at)}</span>
            </li>))}</ul>)}
      </section>
    </div>
  );
}
