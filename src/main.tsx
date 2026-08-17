import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ReturnReport from './ReturnReport.tsx'

// A driver self-report link (…/?report=return) opens the standalone return page.
const isReturnReport = new URLSearchParams(window.location.search).get('report') === 'return';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isReturnReport ? <ReturnReport /> : <App />}
  </StrictMode>,
)
