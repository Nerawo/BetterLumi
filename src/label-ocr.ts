import type { Worker } from "tesseract.js";
import { linesFromTsv, parseNutritionLabel } from "./nutrition-label";
async function prepareImage(source: string) {
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(source))
    throw Error("Local image required");
  const img = new Image();
  img.src = source;
  await img.decode();
  const scale = Math.min(
    2,
    2400 / Math.max(img.naturalWidth, img.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Canvas unavailable");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
export function recognizeLabel(
  source: string,
  language: "eng" | "eng+chi_sim",
  progress: (value: number | null) => void,
) {
  let worker: Worker | null = null;
  let stopped = false;
  let rejectStop: (error: Error) => void = () => {};
  const stop = new Promise<never>((_, reject) => {
    rejectStop = reject;
  });
  const cancel = () => {
    if (stopped) return;
    stopped = true;
    rejectStop(new Error("Recognition cancelled"));
    if (worker) void worker.terminate().catch(() => {});
  };
  const timer = window.setTimeout(cancel, 120000);
  const run = async () => {
    const { createWorker, OEM, PSM } = await import("tesseract.js");
    if (stopped) throw Error("Cancelled");
    const base = new URL(import.meta.env.BASE_URL + "ocr/", location.origin)
      .href;
    worker = await createWorker(
      language === "eng" ? "eng" : "chi_sim+eng",
      OEM.LSTM_ONLY,
      {
        workerPath: base + "worker.min.js",
        corePath: base + "core",
        langPath: base + "lang",
        workerBlobURL: false,
        cachePath: "betterlumi-label-ocr-v7",
        cacheMethod: "write",
        logger: (m) => {
          if (!stopped)
            progress(
              m.status === "recognizing text"
                ? Math.round(m.progress * 100)
                : null,
            );
        },
        errorHandler: () => {},
      },
    );
    if (stopped) {
      await worker.terminate();
      throw Error("Cancelled");
    }
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });
    const image = await prepareImage(source);
    if (stopped) throw Error("Cancelled");
    const result = await worker.recognize(image, {}, { text: true, tsv: true });
    const lines = linesFromTsv(result.data.tsv ?? "");
    return {
      ...parseNutritionLabel(result.data.text, result.data.confidence, lines),
      lines,
    };
  };
  const result = Promise.race([run(), stop]).finally(() => {
    clearTimeout(timer);
    if (worker) void worker.terminate().catch(() => {});
  });
  return { result, cancel };
}
