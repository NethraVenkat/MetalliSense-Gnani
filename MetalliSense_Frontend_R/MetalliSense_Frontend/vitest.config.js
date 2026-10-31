import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['tests/mock-unit.test.js','tests/voice-intents.test.js','tests/hands-free.test.js','tests/voice-panel.test.jsx'],testTimeout:30000},build:{target:'esnext'}});
