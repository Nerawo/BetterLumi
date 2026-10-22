import {nextOrder,associatedNameMatches} from './collection-order';
import {normalizeUserName} from "./user-names";
import { db, recipes, stamp, type Recipe } from "./domain";
import type { RecordBase } from "./db";
import { changed } from "./ui";
export interface RecipeCategory extends RecordBase {
  name: string;
  sortOrder?:number;
}
export const categories = db.table<RecipeCategory>("recipeCategories");
export async function saveCategory(name: string, item?: RecipeCategory) {
  const clean = normalizeCategoryName(name);
  if (!clean) throw Error("Empty category");
  await db.transaction("rw", categories, async () => {
    const duplicate = await categories
      .filter(
        (c) =>
          !c.deletedAt &&
          c.id !== item?.id &&
          normalizeCategoryName(c.name).toLocaleLowerCase() === clean.toLocaleLowerCase(),
      )
      .first();
    if (duplicate) throw Error("Duplicate category");
    const current=item?await categories.get(item.id):undefined;if(item&&(!current||current.deletedAt))throw Error('Category unavailable');
    await categories.put({ ...(current ? changed(current) : {...stamp(),sortOrder:nextOrder(await categories.filter(c=>!c.deletedAt).toArray())}), name: clean });
  });
}
export async function deleteCategory(item: RecipeCategory) {
  await db.transaction("rw", [categories, recipes], async () => {
    await categories.put({
      ...changed(item),
      deletedAt: new Date().toISOString(),
    });
    await recipes
      .filter((r) => (r.categoryIds ?? []).includes(item.id))
      .modify((r) => {
        r.categoryIds = r.categoryIds!.filter((id) => id !== item.id);
        r.updatedAt = new Date().toISOString();
        r.revision++;
      });
  });
}
export function filterRecipes(
  items: Recipe[],
  search: string,
  category: string,
  definitions:RecipeCategory[]=[],
) {
  return items.filter(
    (r) =>
      (r.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) || associatedNameMatches(r.categoryIds,definitions,search)) &&
      (!category || (r.categoryIds ?? []).includes(category)),
  );
}

/** Change only explicitly toggled memberships; keep other categories and recipe fields intact. */
export async function assignCategoryRecipes(categoryId: string, changes: Record<string, boolean>) {
  await db.transaction("rw", [categories, recipes], async () => {
    const category = await categories.get(categoryId);
    if (!category || category.deletedAt) throw Error("Category unavailable");
    for (const [id, included] of Object.entries(changes)) {
      const recipe = await recipes.get(id);
      if (!recipe || recipe.deletedAt) continue;
      const ids = recipe.categoryIds ?? [];
      if (ids.includes(categoryId) === included) continue;
      await recipes.update(id, {
        categoryIds: included ? [...ids, categoryId] : ids.filter(id => id !== categoryId),
        updatedAt: new Date().toISOString(),
        revision: recipe.revision + 1,
      });
    }
  });
}

export const normalizeCategoryName = normalizeUserName;
/** Reuse an existing normalized name instead of creating a duplicate. */
export async function findOrCreateCategory(name: string) {
 const clean=normalizeCategoryName(name);
 if (!clean) throw Error("Empty category");
 return db.transaction("rw",categories,async()=>{
  const existing=await categories.filter(c=>!c.deletedAt&&normalizeCategoryName(c.name).toLocaleLowerCase()===clean.toLocaleLowerCase()).first();
  if(existing) return existing;
  const category={...stamp(),name:clean,sortOrder:nextOrder(await categories.filter(c=>!c.deletedAt).toArray())};await categories.put(category);return category;
 });
}
