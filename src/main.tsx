import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PwaUpdate } from './PwaUpdate';
import { IdentityProvider } from './Identity';
import { KeyboardFrame } from './KeyboardFrame';
import './styles.css';
import './bioimpedance.css';
import './onboarding.css';
import './training-mobile.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><KeyboardFrame/><IdentityProvider><App /></IdentityProvider><PwaUpdate /></React.StrictMode>);
