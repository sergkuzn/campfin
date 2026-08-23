import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/card.css'
import './styles/controls.css'
import './styles/field.css'
import App from './App.tsx'
import { applyTheme, readStoredTheme } from './hooks/useTheme'
import { I18nProvider } from './i18n/I18nProvider'

// Guard instead of a `!` non-null assertion: if #root is missing we want a clear
// error, not a silent crash deeper in React.
const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found in index.html')

// Before the first render, not inside it: `useTheme`'s effect would only run after React
// has painted once, which a returning night-mode user would see as a flash of white.
applyTheme(readStoredTheme())

createRoot(rootEl).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
