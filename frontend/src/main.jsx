import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.jsx';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const tree = (
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {googleClientId
      ? <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>
      : tree}
  </React.StrictMode>
);

