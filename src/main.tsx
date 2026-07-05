import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Guard instead of a `!` non-null assertion: if #root is missing we want a clear
// error, not a silent crash deeper in React.
const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found in index.html')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
