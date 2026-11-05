import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { reassignSchema } from "@/lib/validate";

// Bulk move via the stored procedure reassign_documents (CALL)
export const POST = handle(async (req: NextRequest) => {
  const me = await requireUser();
  const { fromFolderId, toFolderId } = reassignSchema.parse(await req.json());
  const [before] = await query(
    "SELECT COUNT(*)::int AS n FROM documents WHERE user_id = $1 AND folder_id IS NOT DISTINCT FROM $2",
    [me.id, fromFolderId]
  );
  await query("CALL reassign_documents($1, $2, $3)", [me.id, fromFolderId, toFolderId]);
  return ok({ moved: before.n });
});
