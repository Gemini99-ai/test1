import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css'; // We'll import the main styles here

// This is the entry point of your React application.
// It finds the 'root' div in your main HTML file and renders the <App /> component inside it.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
