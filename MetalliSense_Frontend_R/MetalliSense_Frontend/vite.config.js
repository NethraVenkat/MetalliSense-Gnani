import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH || './',
  envPrefix: mode === 'mock' ? ['VITE_VOICE_TOUR_APPROVED_TAMIL', 'VITE_VOICE_TOUR', 'VITE_BILINGUAL_ALERT', 'VITE_VOICE_EVERYWHERE', 'VITE_VOICE_DATA_READS', 'VITE_VOICE_DASHBOARD_BRIEFING', 'VITE_MOCK_MODE', 'VITE_BASE_PATH', 'VITE_COPILOT_BASE_URL', 'VITE_SHOW_VOICE_PANEL', 'VITE_LANG_BRIDGE', 'VITE_HANDOVER', 'VITE_TTS_STREAM', 'VITE_SPOKEN_NORMALIZE', 'VITE_VOICE_CLARITY', 'VITE_VOICE_REGISTER', 'VITE_SHIFT_SUMMARY', 'VITE_TRANSLITERATE'] : 'VITE_',
  build: { target: 'esnext' },
  plugins: [react(), ...(mode === 'mock' ? [{name:'local-demo-fonts', enforce:'pre', generateBundle(){ this.emitFile({type:'asset',fileName:'licenses/demo-fonts.txt',source:['Montserrat','JetBrainsMono'].map(name=>readFileSync(new URL('./src/assets/demo-fonts/OFL-'+name+'.txt',import.meta.url),'utf8')).join('\n\n')}); }, transform(code,id) { if (id.replaceAll('\\','/').endsWith('/src/index.css')) return code.replace(/^@import url\("[^\"]+"\);/,readFileSync(new URL('./src/mock/fonts.css',import.meta.url),'utf8')); }}] : [])],
}))
