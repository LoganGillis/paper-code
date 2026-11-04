import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { OutputApp } from './output-app'
import { ThemeProvider } from '@/components/theme-provider'

const outputWindow = new URLSearchParams(window.location.search).get('paper') === 'output'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>{outputWindow ? <OutputApp /> : <App />}</ThemeProvider>
  </StrictMode>
)
