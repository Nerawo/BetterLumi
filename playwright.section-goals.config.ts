import {defineConfig} from '@playwright/test';
import base from './playwright.numeric.config';
export default defineConfig({...base,testMatch:'section-goals.spec.ts'});
