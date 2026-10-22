import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { recipes, stamp } from "./domain";
import { categories, findOrCreateCategory, saveCategory, assignCategoryRecipes, filterRecipes } from "./categories";
afterEach(async () => { await recipes.clear(); await categories.clear(); });
describe("bulk recipe category assignments", () => {
  it("preserves other categories, snapshots, photos and all other recipe fields, and skips no-ops", async () => {
    const category={...stamp(),name:"Breakfast"};
    await categories.put(category);
    const recipe={...stamp(),name:"Oats",servings:2,lines:[],instructions:"Method",stickyNote:"Note",category:"Legacy",categoryIds:["other", "legacy-unknown"],photo:"data:image/png;base64,original"};
    await recipes.put(recipe);
    await assignCategoryRecipes(category.id,{[recipe.id]:true});
    const added=(await recipes.get(recipe.id))!;
    expect(added).toEqual({...recipe,categoryIds:[...recipe.categoryIds,category.id],updatedAt:expect.any(String),revision:recipe.revision+1});
    await assignCategoryRecipes(category.id,{[recipe.id]:true});
    expect(await recipes.get(recipe.id)).toEqual(added);
    // Another edit may have added a membership while the manager was open.
    await recipes.update(recipe.id,{categoryIds:[...added.categoryIds!,"new-membership"]});
    await assignCategoryRecipes(category.id,{[recipe.id]:false});
    expect((await recipes.get(recipe.id))!.categoryIds).toEqual(["other","legacy-unknown","new-membership"]);
  });
  it("changes several recipes atomically, ignores deleted/missing recipes and keeps filtering read-only", async () => {
    const category={...stamp(),name:"Lunch"};await categories.put(category);
    const base={name:"Recipe",servings:1,lines:[],instructions:"",stickyNote:""};
    const a={...stamp(),...base,categoryIds:[category.id]}, b={...stamp(),...base}, deleted={...stamp(),...base,deletedAt:new Date().toISOString()};
    await recipes.bulkPut([a,b,deleted]);
    await assignCategoryRecipes(category.id,{[a.id]:false,[b.id]:true,[deleted.id]:true,missing:true});
    expect((await recipes.get(a.id))!.categoryIds).toEqual([]);
    expect((await recipes.get(b.id))!.categoryIds).toEqual([category.id]);
    expect(await recipes.get(deleted.id)).toEqual(deleted);
    const before=await recipes.toArray();
    expect(filterRecipes(before.filter(r=>!r.deletedAt),"",category.id).map(r=>r.id)).toEqual([b.id]);
    expect(await recipes.toArray()).toEqual(before);
    await expect(assignCategoryRecipes("missing",{[b.id]:false})).rejects.toThrow();
    expect(await recipes.toArray()).toEqual(before);
  });
});

it("normalizes whitespace and case without duplicating or rewriting existing categories",async()=>{
 const original={...stamp(),name:" Quick   Meals "};await categories.put(original);
 const existing=await findOrCreateCategory("quick meals");expect(existing).toEqual(original);
 await expect(saveCategory("  Quick Meals ")).rejects.toThrow("Duplicate category");
 const [a,b]=await Promise.all([findOrCreateCategory("New   Category"),findOrCreateCategory("new category")]);expect(a.id).toBe(b.id);expect(a.name).toBe("New Category");expect(await categories.count()).toBe(2);
});
