import {defineConfig} from '@playwright/test';
import base from './playwright.config';
/** Production-only check after APP_BASE=/BetterLumi/ npm run build. */
export default defineConfig({...base,testMatch:'natural-foods-offline.spec.ts',testIgnore:[],outputDir:'./work/natural-foods-offline-results',use:{...base.use,baseURL:'http://127.0.0.1:5193',isMobile:true,hasTouch:true,viewport:{width:390,height:844}},webServer:{command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5193 --strictPort',env:{APP_BASE:'/BetterLumi/'},url:'http://127.0.0.1:5193/BetterLumi/',reuseExistingServer:false,timeout:30000}});
