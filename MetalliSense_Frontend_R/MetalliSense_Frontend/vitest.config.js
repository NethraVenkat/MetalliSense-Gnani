import { defineConfig } from 'vitest/config';
export default defineConfig({test:{env:{VITE_LANG_BRIDGE:'false'},include:['tests/mock-unit.test.js','tests/voice-intents.test.js','tests/hands-free.test.js','tests/voice-panel.test.jsx','tests/evon-phrase.test.jsx','tests/language-bridge.test.js','tests/spoken-numbers.test.js'],testTimeout:30000},build:{target:'esnext'}});
