import {defineConfig} from '@playwright/test';
import base from './playwright.numeric.config';
export default defineConfig({...base,testMatch:'goal-preview.spec.ts',testIgnore:[],use:{...base.use,baseURL:'http://127.0.0.1:5191'},webServer:{command:'npm.cmd run preview -- --port 5191 --strictPort',url:'http://127.0.0.1:5191',reuseExistingServer:false,timeout:30000}});
