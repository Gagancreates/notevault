/**
 * Splits text into overlapping chunks of roughly `size` characters.
 * Breaks on paragraph, then sentence, boundaries where possible so chunks stay readable.
 */
export function chunkText(raw: string, size = 900, overlap = 150): string[] {
  const text = raw.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const para = window.lastIndexOf("\n\n");
      const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
      if (para > size * 0.5) end = start + para;
      else if (sentence > size * 0.5) end = start + sentence + 1;
    }
    const piece = text.slice(start, end).trim();
    if (piece.length > 20 || chunks.length === 0) chunks.push(piece);
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.slice(0, 2000);
}
