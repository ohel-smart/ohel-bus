import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ReturnReport from './ReturnReport.tsx'
import BoardView from './BoardView.tsx'
import RegisterRequest from './RegisterRequest.tsx'
import UpdateWatcher from './UpdateWatcher.tsx'

// A driver self-report link (…/?report=return) opens the standalone return page.
const isReturnReport = new URLSearchParams(window.location.search).get('report') === 'return';
// The public arrival board lives at the clean path …/board (see vercel.json for the
// SPA rewrite that lets a direct/hard load of that path resolve to this same bundle).
const isBoardView = window.location.pathname === '/board' || window.location.pathname === '/board/';
// Public self-registration form for new drivers/dispatchers, at …/join.
const isRegisterRequest = window.location.pathname === '/join' || window.location.pathname === '/join/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isBoardView ? <BoardView /> : isReturnReport ? <ReturnReport /> : isRegisterRequest ? <RegisterRequest /> : <App />}
    {/* The arrival board runs unattended on a screen, so it may reload on its own; the rest never do under a person's hands. */}
    <UpdateWatcher mode={isBoardView ? 'auto' : 'idle'} />
  </StrictMode>,
)
