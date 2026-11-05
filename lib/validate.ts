import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Enter a valid e-mail").max(150),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid e-mail"),
  password: z.string().min(1, "Enter your password"),
});

export const folderSchema = z.object({
  name: z.string().trim().min(1, "Folder name is required").max(100, "Folder name is too long"),
});

const uuid = z.string().uuid("Invalid id");

export const documentPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  folderId: uuid.nullable().optional(),
});

export const searchSchema = z.object({
  query: z.string().trim().min(1, "Type something to search").max(500),
  mode: z.enum(["semantic", "keyword", "hybrid"]).default("hybrid"),
  k: z.number().int().min(1).max(25).default(8),
});

export const reassignSchema = z.object({
  fromFolderId: uuid.nullable(),
  toFolderId: uuid.nullable(),
});

export const roleSchema = z.object({ role: z.enum(["admin", "user"]) });
export { uuid };
