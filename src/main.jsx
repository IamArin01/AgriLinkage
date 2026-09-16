import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';
//import AgriLinkage from './AgriLinkage.jsx';
import AgriTradeApp from './AgriTradeApp.jsx';

if (typeof MouseEvent !== 'undefined' && !('mozPressure' in MouseEvent.prototype)) {
  Object.defineProperty(MouseEvent.prototype, 'mozPressure', {
    configurable: true,
    get() {
      return this.pressure ?? 0;
    },
  });
}

if (typeof MouseEvent !== 'undefined' && !('mozInputSource' in MouseEvent.prototype)) {
  Object.defineProperty(MouseEvent.prototype, 'mozInputSource', {
    configurable: true,
    get() {
      if (this.pointerType === 'mouse') return 1;
      if (this.pointerType === 'pen') return 2;
      if (this.pointerType === 'touch') return 3;
      return 0;
    },
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AgriTradeApp />
  </React.StrictMode>
)
