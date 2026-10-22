import {defineConfig} from '@playwright/test';
import base from './playwright.numeric.config';
export default defineConfig({...base,testMatch:'goal-row-save.spec.ts'});
