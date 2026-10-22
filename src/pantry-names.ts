import type { PantryItem } from "./domain";
export function splitAliases(text: string) {
  return [
    ...new Set(
      text
        .split(/[,，、;；\n]+/)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
}
// The historical nameZh field remains in place; reading it as aliases needs no migration.
export function ingredientAliases(item: PantryItem) {
  return [
    ...new Set([...(item.aliases ?? []), ...splitAliases(item.nameZh ?? "")]),
  ];
}
export function matchesIngredient(item: PantryItem, query: string) {
  const q = query.trim().toLocaleLowerCase();
  return [item.name, item.brand, ...ingredientAliases(item)].some((v) =>
    v.toLocaleLowerCase().includes(q),
  );
}

export function ingredientSecondaryNames(item:PantryItem){
 const normalized=(value:string)=>value.normalize('NFKC').trim().toLowerCase();
 const seen=new Set([normalized(item.name)]);
 return [item.brand,...ingredientAliases(item)].map(value=>value.trim()).filter(value=>{
  const key=normalized(value);if(!key||seen.has(key))return false;seen.add(key);return true;
 });
}
