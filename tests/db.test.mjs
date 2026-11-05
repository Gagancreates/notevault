// Database-level tests: constraints, triggers, functions, procedure, transactions.
// Every test runs inside BEGIN ... ROLLBACK so the database is left unchanged.
// Run: npm run test:db
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { loadEnv } from "../scripts/load-env.mjs";

loadEnv();
const url = process.env.DATABASE_URL;
const db = new pg.Client({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1|\/tmp/.test(url) ? false : { rejectUnauthorized: false },
});

const vec = (seed) =>
  "[" + Array.from({ length: 384 }, (_, i) => Math.sin(seed * 7.1 + i * 0.37).toFixed(5)).join(",") + "]";

async function inTx(fn) {
  await db.query("BEGIN");
  try {
    await fn();
  } finally {
    await db.query("ROLLBACK");
  }
}

async function makeUser(email = `t_${Date.now()}_${Math.random().toString(36).slice(2)}@test.dev`) {
  const { rows } = await db.query("SELECT register_user('Tester', $1, 'password123') AS id", [email]);
  return rows[0].id;
}

async function expectError(sql, params, pattern) {
  await db.query("SAVEPOINT sp");
  await assert.rejects(db.query(sql, params), pattern);
  await db.query("ROLLBACK TO SAVEPOINT sp");
}

before(async () => db.connect());
after(async () => db.end());

test("CHECK: rejects an invalid e-mail", () =>
  inTx(() =>
    expectError(
      "INSERT INTO users (name, email, password_hash) VALUES ('x', 'not-an-email', 'h')",
      [],
      /users_email_check/
    )
  ));

test("CHECK: rejects an unknown role", () =>
  inTx(() =>
    expectError(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('x','a@b.co','h','superuser')",
      [],
      /users_role_check/
    )
  ));

test("UNIQUE + trigger: e-mails are normalised, so case variants collide", () =>
  inTx(async () => {
    await makeUser("Case@Test.dev");
    const { rows } = await db.query("SELECT email FROM users WHERE email = 'case@test.dev'");
    assert.equal(rows.length, 1);
    await expectError("SELECT register_user('Dup', 'CASE@test.DEV', 'password123')", [], /users_email_key/);
  }));

test("register_user + verify_login: bcrypt hash stored, correct password accepted, wrong rejected", () =>
  inTx(async () => {
    await makeUser("login@test.dev");
    const h = await db.query("SELECT password_hash FROM users WHERE email='login@test.dev'");
    assert.match(h.rows[0].password_hash, /^\$2[aby]\$/);
    assert.notEqual(h.rows[0].password_hash, "password123");
    const ok = await db.query("SELECT * FROM verify_login('LOGIN@test.dev', 'password123')");
    assert.equal(ok.rows.length, 1);
    const bad = await db.query("SELECT * FROM verify_login('login@test.dev', 'wrong')");
    assert.equal(bad.rows.length, 0);
  }));

test("register_user: rejects passwords shorter than 8 characters", () =>
  inTx(() => expectError("SELECT register_user('x','short@test.dev','abc')", [], /at least 8/)));

test("CHECK: folder name cannot be blank; UNIQUE (user_id, name)", () =>
  inTx(async () => {
    const u = await makeUser();
    await expectError("INSERT INTO folders (user_id, name) VALUES ($1, '   ')", [u], /folders_name_check/);
    await db.query("INSERT INTO folders (user_id, name) VALUES ($1, 'DBMS')", [u]);
    await expectError("INSERT INTO folders (user_id, name) VALUES ($1, 'DBMS')", [u], /folders_user_id_name_key/);
  }));

test("CHECK: documents only accept pdf/txt/md", () =>
  inTx(async () => {
    const u = await makeUser();
    await expectError(
      "INSERT INTO documents (user_id, title, file_type) VALUES ($1, 'x', 'exe')",
      [u],
      /documents_file_type_check/
    );
  }));

test("Trigger trg_folder_owner: cannot file a document in another user's folder", () =>
  inTx(async () => {
    const a = await makeUser();
    const b = await makeUser();
    const { rows } = await db.query("INSERT INTO folders (user_id, name) VALUES ($1, 'Private') RETURNING id", [b]);
    await expectError(
      "INSERT INTO documents (user_id, folder_id, title, file_type) VALUES ($1, $2, 'x', 'txt')",
      [a, rows[0].id],
      /does not belong/
    );
  }));

test("Trigger trg_chunk_status: status flips to ready and chunk_count updates", () =>
  inTx(async () => {
    const u = await makeUser();
    const d = (await db.query(
      "INSERT INTO documents (user_id, title, file_type) VALUES ($1, 'Notes', 'txt') RETURNING id", [u]
    )).rows[0].id;
    await db.query("INSERT INTO chunks (document_id, chunk_index, content) VALUES ($1, 0, 'a'), ($1, 1, 'b')", [d]);
    let doc = (await db.query("SELECT status, chunk_count FROM documents WHERE id=$1", [d])).rows[0];
    assert.deepEqual(doc, { status: "pending", chunk_count: 2 });
    await db.query("UPDATE chunks SET embedding = $2::vector WHERE document_id = $1", [d, vec(1)]);
    doc = (await db.query("SELECT status, chunk_count FROM documents WHERE id=$1", [d])).rows[0];
    assert.deepEqual(doc, { status: "ready", chunk_count: 2 });
  }));

test("Transaction: a failure mid-upload rolls back the document and its chunks", () =>
  inTx(async () => {
    const u = await makeUser();
    await db.query("SAVEPOINT upload");
    const d = (await db.query(
      "INSERT INTO documents (user_id, title, file_type) VALUES ($1, 'Broken', 'txt') RETURNING id", [u]
    )).rows[0].id;
    await db.query("INSERT INTO chunks (document_id, chunk_index, content) VALUES ($1, 0, 'ok')", [d]);
    // duplicate chunk_index violates UNIQUE (document_id, chunk_index)
    await assert.rejects(db.query("INSERT INTO chunks (document_id, chunk_index, content) VALUES ($1, 0, 'dup')", [d]));
    await db.query("ROLLBACK TO SAVEPOINT upload");
    const left = await db.query("SELECT count(*)::int AS n FROM documents WHERE id = $1", [d]);
    assert.equal(left.rows[0].n, 0);
  }));

test("Vector search: semantic_search ranks the closest chunk first", () =>
  inTx(async () => {
    const u = await makeUser();
    const d = (await db.query(
      "INSERT INTO documents (user_id, title, file_type) VALUES ($1, 'Vec', 'txt') RETURNING id", [u]
    )).rows[0].id;
    for (let i = 0; i < 5; i++) {
      await db.query(
        "INSERT INTO chunks (document_id, chunk_index, content, embedding) VALUES ($1, $2, $3, $4::vector)",
        [d, i, `chunk ${i}`, vec(i + 1)]
      );
    }
    const { rows } = await db.query("SELECT * FROM semantic_search($1, $2::vector, 3)", [u, vec(3)]);
    assert.equal(rows[0].chunk_index, 2);
    assert.ok(rows[0].score > 0.999);
    assert.equal(rows.length, 3);
  }));

test("Isolation: semantic_search never returns another user's chunks", () =>
  inTx(async () => {
    const a = await makeUser();
    const b = await makeUser();
    const d = (await db.query(
      "INSERT INTO documents (user_id, title, file_type) VALUES ($1, 'A only', 'txt') RETURNING id", [a]
    )).rows[0].id;
    await db.query(
      "INSERT INTO chunks (document_id, chunk_index, content, embedding) VALUES ($1, 0, 'secret', $2::vector)",
      [d, vec(9)]
    );
    const { rows } = await db.query("SELECT * FROM semantic_search($1, $2::vector, 5)", [b, vec(9)]);
    assert.equal(rows.length, 0);
  }));

test("Full-text search: GIN-indexed tsvector match with ranking", () =>
  inTx(async () => {
    const u = await makeUser();
    const d = (await db.query(
      "INSERT INTO documents (user_id, title, file_type) VALUES ($1, 'FTS', 'txt') RETURNING id", [u]
    )).rows[0].id;
    await db.query(
      `INSERT INTO chunks (document_id, chunk_index, content, embedding) VALUES
       ($1, 0, 'Normalization removes redundancy using functional dependencies', $2::vector),
       ($1, 1, 'Deadlocks occur when processes wait on each other', $3::vector)`,
      [d, vec(1), vec(2)]
    );
    const { rows } = await db.query(
      `SELECT chunk_index FROM chunks
       WHERE document_id = $1 AND to_tsvector('english', content) @@ plainto_tsquery('english', 'normalized dependency')`,
      [d]
    );
    assert.deepEqual(rows.map((r) => r.chunk_index), [0]);
  }));

test("Procedure reassign_documents: moves Unfiled docs; refuses a foreign folder", () =>
  inTx(async () => {
    const u = await makeUser();
    const other = await makeUser();
    const f = (await db.query("INSERT INTO folders (user_id, name) VALUES ($1, 'Sorted') RETURNING id", [u])).rows[0].id;
    const foreign = (await db.query("INSERT INTO folders (user_id, name) VALUES ($1, 'Nope') RETURNING id", [other])).rows[0].id;
    await db.query("INSERT INTO documents (user_id, title, file_type) VALUES ($1,'a','txt'), ($1,'b','md')", [u]);
    await db.query("CALL reassign_documents($1, NULL, $2)", [u, f]);
    const { rows } = await db.query("SELECT count(*)::int AS n FROM documents WHERE folder_id = $1", [f]);
    assert.equal(rows[0].n, 2);
    await expectError("CALL reassign_documents($1, $2, $3)", [u, f, foreign], /does not belong/);
  }));

test("Views + function: user_corpus_stats and get_folder_summary aggregate correctly", () =>
  inTx(async () => {
    const u = await makeUser();
    const f = (await db.query("INSERT INTO folders (user_id, name) VALUES ($1, 'OS') RETURNING id", [u])).rows[0].id;
    await db.query(
      "INSERT INTO documents (user_id, folder_id, title, file_type) VALUES ($1,$2,'a','txt'), ($1,$2,'b','txt'), ($1,NULL,'c','md')",
      [u, f]
    );
    const s = (await db.query("SELECT documents FROM user_corpus_stats WHERE user_id = $1", [u])).rows[0];
    assert.equal(Number(s.documents), 3);
    const { rows } = await db.query("SELECT folder, doc_count FROM get_folder_summary($1)", [u]);
    assert.deepEqual(rows.map((r) => [r.folder, Number(r.doc_count)]), [["OS", 2], ["Unfiled", 1]]);
  }));

test("ON DELETE CASCADE: deleting a user removes their folders, documents and chunks", () =>
  inTx(async () => {
    const u = await makeUser();
    const d = (await db.query(
      "INSERT INTO documents (user_id, title, file_type) VALUES ($1, 'x', 'txt') RETURNING id", [u]
    )).rows[0].id;
    await db.query("INSERT INTO chunks (document_id, chunk_index, content) VALUES ($1, 0, 'c')", [d]);
    await db.query("DELETE FROM users WHERE id = $1", [u]);
    const { rows } = await db.query("SELECT count(*)::int AS n FROM chunks WHERE document_id = $1", [d]);
    assert.equal(rows[0].n, 0);
  }));
