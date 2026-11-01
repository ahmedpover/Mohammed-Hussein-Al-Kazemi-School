import React from 'react';
import { Bell } from 'lucide-react';
import { date } from './api.js';
import { markNotificationRead } from './cloudData.js';
import './admin.css';
export default function Notifications({items,onRefresh}) {
 const [busy,setBusy]=React.useState(null),[error,setError]=React.useState('');
 async function read(item){setBusy(item.id);setError('');try{await markNotificationRead(item.id);await onRefresh();}catch(cause){setError(cause.message);}finally{setBusy(null);}}
 return <section className="section-block"><div className="section-head"><div><h3>إشعارات الإدارة</h3><p>الرسائل الخاصة التي أُرسلت إليك من إدارة المدرسة</p></div><Bell size={23}/></div>{error&&<p className="form-error" role="alert">{error}</p>}{items.length?<div className="admin-notifications">{items.map(item=><article key={item.id} className={`admin-notification ${item.readAt?'':'unread'}`}><div><p>{item.message}</p><small>{date(item.createdAt)} · {item.readAt?'مقروء':'جديد'}</small></div>{!item.readAt&&<button className="secondary-button" disabled={busy===item.id} onClick={()=>read(item)}>تحديد كمقروء</button>}</article>)}</div>:<p className="quiet-empty">لا توجد إشعارات بعد.</p>}</section>;
}
