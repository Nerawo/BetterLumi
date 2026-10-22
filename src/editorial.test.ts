import "fake-indexeddb/auto";
import { it, expect, afterEach } from "vitest";
import { db, stamp, exportAll, restoreAll } from "./domain";
import { themeOptions, resolvedTheme } from "./themes";
afterEach(async () => {
  for (const table of db.tables) await table.clear();
});
it("original cover bytes and per-image crops are backed up alongside legacy images and photos", async () => {
  const image = {
    ...stamp(),
    kind: "cover",
    original: "data:image/jpeg;base64,ORIGINAL",
    name: "原图.jpg",
    width: 200,
    height: 100,
    crop: { zoom: 2.2, x: 0.4, y: 0.6 },
  };
  const legacy = { ...stamp(), value: "legacy image" };
  await db.images.bulkPut([image, legacy]);
  await db.settings.put({ key: "coverMode", value: "daily" });
  const backup = await exportAll();
  await restoreAll(JSON.parse(JSON.stringify(backup)));
  expect(await db.images.get(image.id)).toEqual(image);
  expect(await db.images.get(legacy.id)).toEqual(legacy);
  expect(await db.settings.get("coverMode")).toEqual({
    key: "coverMode",
    value: "daily",
  });
  const malformed = structuredClone(backup);
  (
    malformed.tables.images.find((row: any) => row.kind === "cover") as any
  ).crop = { zoom: 0, x: 0, y: 0 };
  await expect(restoreAll(malformed)).rejects.toThrow();
  expect(await db.images.get(image.id)).toEqual(image);
});
it("four complete themes resolve explicitly; new installs default to Misty and saved Olive is preserved", () => {
  expect(themeOptions).toHaveLength(4);
  expect(resolvedTheme().id).toBe("misty");
  expect(resolvedTheme("olive").id).toBe("olive");
  for (const theme of themeOptions)
    for (const key of [
      "color",
      "bg",
      "surface",
      "ink",
      "soft",
      "line",
      "muted",
      "action",
    ])
      expect(theme[key as keyof typeof theme]).toMatch(/^#[0-9a-f]{6}$/i);
});
