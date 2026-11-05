import { handle, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async () => ok({ user: await getSession() }));
