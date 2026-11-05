// End-to-end API tests. Needs the app (npm run dev / start) and the embedding service running.
// Run: BASE_URL=http://localhost:3000 npm run test:api
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const stamp = Date.now();

function client() {
  let cookie = "";
  const call = async (path, { method = "GET", json, form } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(json ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
      body: json ? JSON.stringify(json) : form,
      redirect: "manual",
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  };
  const upload = (file, folderId) => {
    const fd = new FormData();
    fd.append("file", new Blob([fs.readFileSync(file)]), file.split("/").pop());
    if (folderId) fd.append("folderId", folderId);
    return call("/api/documents", { method: "POST", form: fd });
  };
  return { call, upload };
}

const alice = client();
const bob = client();
const admin = client();
const anon = client();
const state = {};

test("signup creates an account and logs in", async () => {
  const r = await alice.call("/api/auth/signup", {
    method: "POST",
    json: { name: "Alice", email: `alice${stamp}@test.dev`, password: "password123" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.role, "user");
  const me = await alice.call("/api/me");
  assert.equal(me.body.user.name, "Alice");
});

test("signup rejects a duplicate e-mail (case-insensitive) with 409", async () => {
  const r = await anon.call("/api/auth/signup", {
    method: "POST",
    json: { name: "Alice 2", email: `ALICE${stamp}@test.dev`, password: "password123" },
  });
  assert.equal(r.status, 409);
});

test("signup rejects a short password with 400", async () => {
  const r = await anon.call("/api/auth/signup", {
    method: "POST",
    json: { name: "Shorty", email: `short${stamp}@test.dev`, password: "abc" },
  });
  assert.equal(r.status, 400);
});

test("login with a wrong password returns 401", async () => {
  const r = await anon.call("/api/auth/login", {
    method: "POST",
    json: { email: `alice${stamp}@test.dev`, password: "nope-nope" },
  });
  assert.equal(r.status, 401);
});

test("protected API without a session returns 401", async () => {
  const r = await anon.call("/api/documents");
  assert.equal(r.status, 401);
});

test("folders: create, and duplicate name returns 409", async () => {
  const a = await alice.call("/api/folders", { method: "POST", json: { name: "DBMS" } });
  assert.equal(a.status, 201);
  state.dbms = a.body.folder.id;
  const b = await alice.call("/api/folders", { method: "POST", json: { name: "Operating Systems" } });
  state.os = b.body.folder.id;
  const dup = await alice.call("/api/folders", { method: "POST", json: { name: "DBMS" } });
  assert.equal(dup.status, 409);
});

test("upload: .md, .txt and .pdf are chunked, embedded and marked ready (transaction + trigger)", async () => {
  for (const [file, folder] of [
    ["sample-notes/normalization.md", state.dbms],
    ["sample-notes/transactions.txt", state.dbms],
    ["sample-notes/indexing.pdf", state.dbms],
    ["sample-notes/deadlocks.md", null],
  ]) {
    const r = await alice.upload(file, folder);
    assert.equal(r.status, 201, `${file}: ${r.body.error}`);
    assert.equal(r.body.document.status, "ready");
    assert.ok(r.body.document.chunk_count >= 1);
    if (file.endsWith("normalization.md")) state.normDoc = r.body.document.id;
    if (file.endsWith("deadlocks.md")) state.deadDoc = r.body.document.id;
  }
});

test("upload rejects unsupported file types with 400", async () => {
  const fd = new FormData();
  fd.append("file", new Blob(["MZ"]), "virus.exe");
  const r = await alice.call("/api/documents", { method: "POST", form: fd });
  assert.equal(r.status, 400);
});

test("documents: filter by folder and sort by title", async () => {
  const r = await alice.call(`/api/documents?folder=${state.dbms}&sort=title`);
  assert.equal(r.status, 200);
  assert.equal(r.body.documents.length, 3);
  const titles = r.body.documents.map((d) => d.title);
  assert.deepEqual(titles, [...titles].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  const unfiled = await alice.call("/api/documents?folder=unfiled");
  assert.equal(unfiled.body.documents.length, 1);
});

test("keyword search (full-text) finds the normalization note", async () => {
  const r = await alice.call("/api/search", { method: "POST", json: { query: "normal form", mode: "keyword" } });
  assert.equal(r.status, 200);
  assert.ok(r.body.results.length > 0);
  assert.equal(r.body.results[0].title, "normalization");
  assert.ok(r.body.results[0].highlight.includes("⟦"));
});

test("semantic and hybrid search return ranked results and are logged", async () => {
  for (const mode of ["semantic", "hybrid"]) {
    const r = await alice.call("/api/search", {
      method: "POST",
      json: { query: "how does the database recover committed work after a crash", mode },
    });
    assert.equal(r.status, 200);
    assert.ok(r.body.results.length > 0);
    const scores = r.body.results.map((x) => Number(x.score));
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  }
  const recent = await alice.call("/api/search");
  assert.ok(recent.body.recent.length >= 3);
});

test("search validates input: empty query returns 400", async () => {
  const r = await alice.call("/api/search", { method: "POST", json: { query: "   ", mode: "hybrid" } });
  assert.equal(r.status, 400);
});

test("isolation: another user cannot see or file into Alice's data", async () => {
  await bob.call("/api/auth/signup", {
    method: "POST",
    json: { name: "Bob", email: `bob${stamp}@test.dev`, password: "password123" },
  });
  const s = await bob.call("/api/search", { method: "POST", json: { query: "normal form", mode: "keyword" } });
  assert.equal(s.body.results.length, 0);
  const doc = await bob.call(`/api/documents/${state.normDoc}`);
  assert.equal(doc.status, 404);
  const bobFolder = await bob.call("/api/folders", { method: "POST", json: { name: "Bob only" } });
  // Alice tries to move her document into Bob's folder → blocked by trigger trg_folder_owner
  const mv = await alice.call(`/api/documents/${state.deadDoc}`, {
    method: "PATCH",
    json: { folderId: bobFolder.body.folder.id },
  });
  assert.equal(mv.status, 400);
});

test("stored procedure: move all Unfiled documents into a folder", async () => {
  const r = await alice.call("/api/folders/reassign", {
    method: "POST",
    json: { fromFolderId: null, toFolderId: state.os },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.moved, 1);
  const os = await alice.call(`/api/documents?folder=${state.os}`);
  assert.equal(os.body.documents[0].title, "deadlocks");
});

test("related notes: vector self-join returns chunks from other documents", async () => {
  const d = await alice.call(`/api/documents/${state.normDoc}`);
  const r = await alice.call(`/api/documents/x/related?chunk=${d.body.chunks[0].id}`);
  assert.equal(r.status, 200);
  assert.ok(r.body.related.every((x) => x.document_id !== state.normDoc));
});

test("roles: a normal user gets 403 on admin APIs; the admin gets 200", async () => {
  const r = await alice.call("/api/admin/stats");
  assert.equal(r.status, 403);
  const login = await admin.call("/api/auth/login", {
    method: "POST",
    json: { email: "admin@notevault.dev", password: "admin12345" },
  });
  assert.equal(login.status, 200);
  const s = await admin.call("/api/admin/stats");
  assert.equal(s.status, 200);
  assert.ok(s.body.totals.documents >= 4);
});

test("admin can delete a user; their data cascades away", async () => {
  const users = await admin.call("/api/admin/users");
  const b = users.body.users.find((u) => u.email === `bob${stamp}@test.dev`);
  const del = await admin.call(`/api/admin/users/${b.id}`, { method: "DELETE" });
  assert.equal(del.status, 200);
  const me = await bob.call("/api/documents");
  assert.equal(me.status, 401);
});

test("deleting a document removes it and its chunks", async () => {
  const r = await alice.call(`/api/documents/${state.deadDoc}`, { method: "DELETE" });
  assert.equal(r.status, 200);
  const again = await alice.call(`/api/documents/${state.deadDoc}`);
  assert.equal(again.status, 404);
});
