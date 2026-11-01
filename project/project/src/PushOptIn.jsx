import React, {useEffect,useState} from 'react';
import { api } from './api.js';
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
const bytes = value => {
  const padded = value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=');
  return Uint8Array.from(atob(padded),char=>char.charCodeAt(0));
};
export default function PushOptIn(){
  const [status,setStatus] = useState('loading');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  useEffect(()=>{
    if(!supported()){setStatus('unsupported');return;}
    let active=true;
    (async()=>{
      const key=await api('/push/key');
      if(!active)return;
      if(!key.publicKey){setStatus('disabled');return;}
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.getSubscription();
      if(!active)return;
      if(subscription){await api('/push/subscriptions',{method:'POST',body:JSON.stringify(subscription.toJSON())});setStatus('active');}
      else setStatus(Notification.permission==='denied'?'denied':'available');
    })().catch(()=>{if(active)setStatus('error');});
    return()=>{active=false;};
  },[]);
  async function enable(){
    setBusy(true);setMessage('');
    try{
      const key=await api('/push/key');
      if(!key.publicKey)throw new Error('لم تُفعّل الإشعارات على الخادم.');
      const permission=await Notification.requestPermission();
      if(permission!=='granted'){setStatus(permission==='denied'?'denied':'available');return;}
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(key.publicKey)});
      await api('/push/subscriptions',{method:'POST',body:JSON.stringify(subscription.toJSON())});
      setStatus('active');
    }catch(e){setMessage(e.message||'تعذر تفعيل الإشعارات.');}finally{setBusy(false);}
  }
  async function disable(){
    setBusy(true);setMessage('');
    try{
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.getSubscription();
      if(subscription){await api('/push/subscriptions',{method:'DELETE',body:JSON.stringify({endpoint:subscription.endpoint})});await subscription.unsubscribe();}
      setStatus('available');
    }catch(e){setMessage(e.message||'تعذر إيقاف الإشعارات.');}finally{setBusy(false);}
  }
  if(['loading','disabled'].includes(status))return null;
  return <section className="push-opt-in"><div><strong>إشعارات الهاتف</strong><p>{status==='active'?'الإشعارات مفعّلة على هذا الجهاز.':status==='denied'?'تم حظر الإشعارات. فعّلها من إعدادات المتصفح.':status==='unsupported'?'هذا المتصفح لا يدعم إشعارات الويب. على iPhone ثبّت الموقع على الشاشة الرئيسية أولاً.':'استلم تنبيهات المحاضرات ورسائل الأساتذة وإشعارات الإدارة حتى إذا كان الموقع مغلقاً.'}</p></div>{status==='active'?<button type="button" className="secondary-button" disabled={busy} onClick={disable}>إيقاف الإشعارات</button>:['available','error'].includes(status)&&<button type="button" className="primary-button" disabled={busy} onClick={enable}>تفعيل الإشعارات</button>}{message&&<p role="alert">{message}</p>}</section>;
}
