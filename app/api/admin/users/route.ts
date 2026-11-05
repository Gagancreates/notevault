import { query } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireAdmin();
  const users = await query(
    `SELECT u.id, u.name, u.email, u.role, u.created_at,
            COUNT(d.id)::int AS documents
     FROM users u LEFT JOIN documents d ON d.user_id = u.id
     GROUP BY u.id ORDER BY u.created_at`
  );
  return ok({ users });
});
