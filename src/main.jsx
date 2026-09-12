import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';
//import AgriLinkage from './AgriLinkage.jsx';
import AgriTradeApp from './AgriTradeApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AgriTradeApp />
  </React.StrictMode>
)
