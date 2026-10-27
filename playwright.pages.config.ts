import {defineConfig} from '@playwright/test';
import base from './playwright.config';
const {channel,launchOptions,...shared}=base.use??{};
export default defineConfig({...base,testMatch:'github-pages.spec.ts',testIgnore:[],workers:1,
  outputDir:'./work/pages-compatibility/browser-artifacts',
  use:{...shared,baseURL:'http://127.0.0.1:5201',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  projects:[{name:'Chrome',use:{browserName:'chromium',channel:'chrome',launchOptions}},{name:'WebKit',use:{browserName:'webkit'}}],
  webServer:{command:'node tests/support/pages-server.mjs',url:'http://127.0.0.1:5201/BetterLumi/',reuseExistingServer:false,timeout:30000},
});
