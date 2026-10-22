import {defineConfig} from '@playwright/test';
import base from './playwright.numeric.config';
export default defineConfig({...base,testMatch:['goal-ui-state.spec.ts','goal-macro-layout.spec.ts']});
