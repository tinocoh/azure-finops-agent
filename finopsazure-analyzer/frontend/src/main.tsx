// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from './router';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
