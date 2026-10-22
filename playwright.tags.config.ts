import {defineConfig} from '@playwright/test';
import mobile from './playwright.numeric.config';
export default defineConfig({...mobile,testMatch:'ingredient-tags.spec.ts'});
