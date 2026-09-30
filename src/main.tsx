import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { streamSystemBootLogs } from './utils/systemBootLogger';

// Start rapid technical console process stream immediately on app open
streamSystemBootLogs();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
