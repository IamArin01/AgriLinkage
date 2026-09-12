import React from 'react'
import {createRoot} from 'react-dom/client'
import './index.css';
import AgriTradeApp from './AgriTradeApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AgriTradeApp />
  </React.StrictMode>
)
