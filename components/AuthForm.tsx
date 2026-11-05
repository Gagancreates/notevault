"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Alert } from "./ui";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/dashboard";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = mode === "login" ? { email: form.email, password: form.password } : form;
      await api(`/api/auth/${mode}`, { method: "POST", json: body });
      router.push(next);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 grid max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-8 text-white md:flex">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-white text-xs font-bold text-ink">NV</span>
          NoteVault
        </div>
        <div>
          <p className="text-2xl font-semibold leading-snug">Search your notes by meaning, not by exact words.</p>
          <p className="mt-3 text-sm text-slate-300">
            Upload PDFs and text notes. NoteVault chunks and embeds them, so “removing redundant data” finds your
            page on normalization.
          </p>
        </div>
        <p className="text-xs text-slate-400">PostgreSQL · pgvector · Next.js</p>
      </div>
      <form onSubmit={submit} className="space-y-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{mode === "login" ? "Log in" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "login" ? "Welcome back." : "Accounts start with the User role."}
          </p>
        </div>
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className="input" value={form.name} onChange={set("name")} required minLength={2} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" type="email" className="input" value={form.email} onChange={set("email")} required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="input"
            value={form.password}
            onChange={set("password")}
            required
            minLength={mode === "signup" ? 8 : 1}
          />
        </div>
        <Alert>{error}</Alert>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
        </button>
        <p className="text-center text-sm text-slate-500">
          {mode === "login" ? (
            <>No account? <Link className="text-accent hover:underline" href="/signup">Sign up</Link></>
          ) : (
            <>Have an account? <Link className="text-accent hover:underline" href="/login">Log in</Link></>
          )}
        </p>
      </form>
    </div>
  );
}
