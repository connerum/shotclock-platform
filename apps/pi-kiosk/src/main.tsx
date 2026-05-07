import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

if (new URLSearchParams(window.location.search).get('showCursor') === '1') {
  document.documentElement.classList.add('show-cursor');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
