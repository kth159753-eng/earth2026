import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = await (await import("node:fs/promises")).readFile(join(root, "src/lib/exams.ts"), "utf8");
const files = [...source.matchAll(/\{ id: "([^"]+)", name: "([^"]+)" \}/g)].map((match) => ({
  id: match[1],
  name: match[2],
}));

function sessionPath(name) {
  const match = name.match(/^(\d{4})_(\d{1,2})월( 지2)?(\(답\))?\.pdf$/);
  if (!match) return null;
  const year = match[1];
  const month = String(Number(match[2])).padStart(2, "0");
  const subject = match[3] ? "II" : "I";
  const kind = match[4] ? "solution.pdf" : "paper.pdf";
  return join(root, "public", "exams", `${year}-${month}-${subject}`, kind);
}

function urlsFor(id) {
  return [
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${id}&confirm=t`,
  ];
}

function confirmUrl(html, id) {
  const confirm = html.match(/confirm=([0-9A-Za-z_-]+)/)?.[1];
  const uuid = html.match(/name="uuid"\s+value="([^"]+)"/)?.[1];
  if (!confirm && !uuid) return null;
  const params = new URLSearchParams({ id, export: "download" });
  if (confirm) params.set("confirm", confirm);
  if (uuid) params.set("uuid", uuid);
  return `https://drive.usercontent.google.com/download?${params.toString()}`;
}

async function readPdf(url, id) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length >= 800 && bytes.subarray(0, 4).toString() === "%PDF") return bytes;
  const retry = confirmUrl(bytes.toString("utf8"), id);
  if (!retry || retry === url) throw new Error("not a pdf");
  const second = await fetch(retry, { redirect: "follow" });
  if (!second.ok) throw new Error(`${second.status}`);
  const next = Buffer.from(await second.arrayBuffer());
  if (next.length < 800 || next.subarray(0, 4).toString() !== "%PDF") throw new Error("not a pdf");
  return next;
}

async function download(id) {
  let lastError = new Error("download failed");
  for (const url of urlsFor(id)) {
    try {
      return await readPdf(url, id);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError;
}

let saved = 0;
for (const file of files) {
  const dest = sessionPath(file.name);
  if (!dest) continue;
  await mkdir(dirname(dest), { recursive: true });
  try {
    const bytes = await download(file.id);
    await writeFile(dest, bytes);
    saved += 1;
    console.log(`saved ${file.name} (${Math.round(bytes.length / 1024)}kb)`);
  } catch (error) {
    console.warn(`skip ${file.name}: ${error instanceof Error ? error.message : error}`);
  }
}

console.log(`Fetched ${saved}/${files.length} exam PDFs.`);
if (saved === 0) process.exit(1);
