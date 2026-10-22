import { mkdir, copyFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function copy(source, target) {
  await mkdir(path.dirname(target), { recursive: true });
  try {
    const [a, b] = await Promise.all([stat(source), stat(target)]);
    if (a.size === b.size) return;
  } catch {}
  await copyFile(source, target);
}
await copy(
  path.join(root, "node_modules/tesseract.js/dist/worker.min.js"),
  path.join(root, "public/ocr/worker.min.js"),
);
const core = path.join(root, "node_modules/tesseract.js-core");
for (const name of await readdir(core))
  if (name.endsWith(".wasm.js") || name.endsWith(".wasm"))
    await copy(path.join(core, name), path.join(root, "public/ocr/core", name));
for (const lang of ["eng", "chi_sim"])
  await copy(
    path.join(
      root,
      "node_modules/@tesseract.js-data",
      lang,
      "4.0.0_best_int",
      lang + ".traineddata.gz",
    ),
    path.join(root, "public/ocr/lang", lang + ".traineddata.gz"),
  );
await copy(
  path.join(core, "LICENSE"),
  path.join(root, "public/ocr/LICENSE-core.txt"),
);
console.log(
  "Local OCR worker, engines and English/Chinese language assets prepared.",
);
