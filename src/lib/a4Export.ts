const A4_PT = { w: 595.28, h: 841.89 };

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function jpegPagesToPdf(
  pages: { jpeg: Uint8Array; width: number; height: number }[]
): Blob {
  const parts: Uint8Array[] = [];
  const offsets = [0];
  let pos = 0;

  function write(data: Uint8Array | string) {
    const bytes = typeof data === "string" ? encode(data) : data;
    parts.push(bytes);
    pos += bytes.length;
  }

  function startObj() {
    offsets.push(pos);
  }

  write("%PDF-1.4\n");

  startObj();
  write("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  const kids = pages
    .map((_, index) => `${3 + index * 3} 0 R`)
    .join(" ");
  startObj();
  write(
    `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`
  );

  pages.forEach((page, index) => {
    const pageObj = 3 + index * 3;
    const imageObj = pageObj + 1;
    const contentObj = pageObj + 2;
    startObj();
    write(
      `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT.w} ${A4_PT.h}] /Resources << /XObject << /Im0 ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj\n`
    );
    startObj();
    write(
      `${imageObj} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`
    );
    write(page.jpeg);
    write("\nendstream\nendobj\n");
    const content = `q ${A4_PT.w} 0 0 ${A4_PT.h} 0 0 cm /Im0 Do Q\n`;
    startObj();
    write(
      `${contentObj} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`
    );
  });

  const xrefPos = pos;
  const size = offsets.length;
  write(`xref\n0 ${size}\n`);
  write("0000000000 65535 f \n");
  for (let i = 1; i < size; i += 1) {
    write(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  return new Blob([concat(parts)], { type: "application/pdf" });
}

export function paginateItems<T>(items: T[], firstPage = 8, nextPage = 10): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [items.slice(0, firstPage)];
  for (let i = firstPage; i < items.length; i += nextPage) {
    pages.push(items.slice(i, i + nextPage));
  }
  return pages;
}

export function openTelegramShare(text: string) {
  const share = new URL("https://t.me/share/url");
  share.searchParams.set("url", window.location.origin);
  share.searchParams.set("text", text);
  window.open(share.toString(), "_blank", "noopener,noreferrer");
}

export async function sendTelegramFile(opts: {
  botToken: string;
  chatId: string;
  file: File;
  caption?: string;
}): Promise<void> {
  const token = opts.botToken.trim();
  const chatId = opts.chatId.trim();
  if (!token || !chatId) {
    throw new Error("missing telegram config");
  }

  const form = new FormData();
  form.append("chat_id", chatId);
  const caption = (opts.caption ?? "").slice(0, 1024);
  if (caption) form.append("caption", caption);

  const isImage = opts.file.type.startsWith("image/");
  form.append(isImage ? "photo" : "document", opts.file, opts.file.name);

  const endpoint = isImage ? "sendPhoto" : "sendDocument";
  const res = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
    method: "POST",
    body: form,
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
  } | null;
  if (!res.ok || !data?.ok) {
    throw new Error(data?.description || "telegram send failed");
  }
}

export async function shareFileToTelegram(
  file: File,
  text: string,
  settings?: { botToken: string; chatId: string; enabled: boolean } | null
): Promise<"bot" | "shared" | "telegram" | "download"> {
  if (settings?.enabled && settings.botToken.trim() && settings.chatId.trim()) {
    await sendTelegramFile({
      botToken: settings.botToken,
      chatId: settings.chatId,
      file,
      caption: text,
    });
    return "bot";
  }

  const canShareFile =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    (!navigator.canShare || navigator.canShare({ files: [file] }));

  if (canShareFile) {
    try {
      await navigator.share({
        files: [file],
        title: file.name,
        text,
      });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "shared";
      }
    }
  }

  downloadBlob(file, file.name);
  openTelegramShare(text);
  return "telegram";
}
