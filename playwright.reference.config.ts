import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:['exercise-presets-phase3b.spec.ts','built-in-exercises.spec.ts','ingredient-tag-management.spec.ts','pantry-row-layout.spec.ts','built-in-foods-phase2b.spec.ts','pantry-built-in-foods.spec.ts','built-in-foods.spec.ts','reference-library.spec.ts','ingredient-tags.spec.ts','unified-collections.spec.ts','unit-defaults.spec.ts'],use:{...base.use,hasTouch:true}});
