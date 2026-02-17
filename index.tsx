
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';

// Safe shim for process.env in the browser. 
// Vite's 'define' config will replace 'process.env.API_KEY' with the actual key.
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || { env: {} };
  (window as any).process.env = (window as any).process.env || {};
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
