import {useLiveQuery} from 'dexie-react-hooks';
import {db} from './domain';
import {ingredientPreferencePrefix,ingredientPreferenceRows} from './ingredient-preferences';
export function useIngredientPreferences(){return useLiveQuery(()=>db.settings.where('key').startsWith(ingredientPreferencePrefix).toArray().then(ingredientPreferenceRows))??{}}
