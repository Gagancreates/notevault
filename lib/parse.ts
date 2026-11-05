import { extractText as extractPdf, getDocumentProxy } from "unpdf";
import { HttpError } from "./auth";

export type FileType = "pdf" | "txt" | "md";

export function detectType(filename: string): FileType {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf" || ext === "txt" || ext === "md") return ext;
  throw new HttpError(400, "Only .pdf, .txt and .md files are supported");
}

export async function extractText(buf: Buffer, type: FileType): Promise<string> {
  if (type === "pdf") {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractPdf(pdf, { mergePages: true });
      return Array.isArray(text) ? text.join("\n\n") : text;
    } catch (e) {
      console.error("PDF parse failed:", e);
      throw new HttpError(400, "Could not read that PDF");
    }
  }
  return buf.toString("utf8");
}
