import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import CloudApp from './CloudApp.jsx';
import './style.css';
import './formal.css';
createRoot(document.getElementById('root')).render(location.protocol==='file:'?<App/>:<CloudApp/>);
