import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'


if (import.meta.env.VITE_MOCK_MODE === 'true') {
  await (await import('./mock/server.js')).startMock();
}

const { default: App } = await import('./App.jsx');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
