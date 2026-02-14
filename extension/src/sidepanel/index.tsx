import React from 'react'
import { createRoot } from 'react-dom/client'
import { SidePanelWithErrorBoundary } from './SidePanel'
import '../styles.css'

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <SidePanelWithErrorBoundary />
  </React.StrictMode>
)
