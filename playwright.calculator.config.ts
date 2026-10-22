import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:['active-goals-overview.spec.ts','professional-guidance.spec.ts','weight-sync.spec.ts','weight-measurements.spec.ts','planner-quick-ranges.spec.ts','planner-read-only.spec.ts','weight-editor.spec.ts','health-calculator.spec.ts','goal-plan-ui.spec.ts','goal-row-save.spec.ts','persistent-bmi.spec.ts'],timeout:60000,
  webServer:{...base.webServer,command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5190 --strictPort',url:'http://127.0.0.1:5190',reuseExistingServer:!process.env.CI,timeout:30000},
  use:{...base.use,hasTouch:true},
});
