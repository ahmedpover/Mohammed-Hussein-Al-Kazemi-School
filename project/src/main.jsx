import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import CloudApp from './CloudApp.jsx';
import { cloudEnabled } from './firebase.js';
import './style.css';
import './formal.css';

function MissingConfiguration() {
  return <div className="app entry-account"><main className="entry-main"><div className="entry-content"><section className="account-card"><span className="overline">مدرسة الشيخ محمد حسين الكاظمي</span><h2>إعداد الحسابات قيد الإكمال</h2><p>يلزم تفعيل إعدادات Firebase قبل استخدام الموقع بحسابات حقيقية. راجع تعليمات الإعداد في المشروع.</p></section></div></main></div>;
}

createRoot(document.getElementById('root')).render(cloudEnabled ? <CloudApp /> : location.protocol === 'file:' ? <App /> : <MissingConfiguration />);
