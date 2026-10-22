import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['tests/mock-unit.test.js'],testTimeout:30000},build:{target:'esnext'}});
