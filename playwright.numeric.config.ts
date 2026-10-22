import {defineConfig} from '@playwright/test';
import base from './playwright.config';
const {channel,launchOptions,...shared}=base.use??{};
export default defineConfig({...base,testMatch:['numeric-inputs.spec.ts','unit-defaults.spec.ts'],use:{...shared,isMobile:true,hasTouch:true},projects:[
 {name:'Chrome',use:{browserName:'chromium',channel:'chrome',launchOptions}},
 {name:'WebKit',use:{browserName:'webkit'}},
]});
