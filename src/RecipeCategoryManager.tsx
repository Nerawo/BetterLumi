import {moveOrderedItem} from './collection-order';
import {NamedCollectionManager} from './NamedCollectionManager';
import {categories,saveCategory,deleteCategory,type RecipeCategory} from './categories';
export function RecipeCategoryManager(props:{items:RecipeCategory[];close:()=>void;onDeleted:(id:string)=>void}){
 return <NamedCollectionManager {...props} save={saveCategory} remove={deleteCategory} reorder={(id,target)=>moveOrderedItem(categories,id,target)}/>;
}
