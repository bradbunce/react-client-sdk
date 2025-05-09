import React from 'react';
import ReactDOM from 'react-dom/client';
import LoggerExample from './LoggerExample';
import './index.css';

// Removed StrictMode to prevent double initialization of the LaunchDarkly client
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <LoggerExample />
  );
}
