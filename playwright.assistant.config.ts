import {defineConfig} from '@playwright/test';
import base from './playwright.config';
const shared={...base.use,channel:undefined};
export default defineConfig({...base,use:shared,webServer:base.webServer?{...base.webServer,command:base.webServer.command.replace('127.0.0.1','0.0.0.0')}:undefined,testMatch:['ai-meal-preview.spec.ts','ai-meal-import.spec.ts','ai-mobile-compat.spec.ts'],timeout:30000,projects:[
 {name:'webkit-mobile',use:{browserName:'webkit',isMobile:true,hasTouch:true,viewport:{width:390,height:844}}},
 {name:'chrome-desktop',use:{browserName:'chromium',channel:'chrome',viewport:{width:1280,height:900}}},
]});
