import { useState } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile, reload, signOut } from 'firebase/auth';
import { auth } from './firebase.js';
import { LockKeyhole } from 'lucide-react';
import './account.css';

export function authError(error) {
  const messages = {
    'auth/email-already-in-use': 'هذا البريد مسجّل مسبقًا. ادخل إلى حسابك أو استعد كلمة المرور.',
    'auth/invalid-email': 'تأكد من كتابة البريد الإلكتروني بصورة صحيحة.',
    'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة.',
    'auth/weak-password': 'اختر كلمة مرور أقوى.',
    'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلًا ثم حاول ثانية.',
    'auth/operation-not-allowed': 'فعّل تسجيل البريد وكلمة المرور في Firebase Authentication.',
  };
  return messages[error?.code] || 'تعذر الاتصال بخدمة الحسابات. حاول ثانية.';
}

export default function CloudAccount({ user, onVerified }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const address = email.trim().toLowerCase();
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, address);
        setMessage('إذا كان البريد مسجلًا، ستصلك رسالة لاستعادة كلمة المرور.');
      } else if (mode === 'register') {
        if (!name.trim()) throw new Error('اكتب اسمك.');
        const { user: created } = await createUserWithEmailAndPassword(auth, address, password);
        await updateProfile(created, { displayName: name.trim() });
        await sendEmailVerification(created);
        setMessage('أنشئ الحساب. افتح بريدك واضغط رابط التأكيد، ثم ارجع لهذه الصفحة.');
      } else {
        await signInWithEmailAndPassword(auth, address, password);
      }
      setPassword('');
    } catch (cause) { setError(cause.code ? authError(cause) : cause.message); }
    finally { setBusy(false); }
  }

  if (user && !user.emailVerified) return <section className="account-card cloud-auth"><span className="overline">تأكيد البريد</span><h2>تحقق من بريدك الإلكتروني</h2><p>أرسلنا رابط تأكيد إلى <b dir="ltr">{user.email}</b>. بعد التأكيد اضغط الزر أدناه.</p>
    <div className="cloud-auth-actions"><button className="primary-button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await reload(user); if (auth.currentUser?.emailVerified) { await auth.currentUser.getIdToken(true); onVerified(); } else setError('البريد لم يُؤكّد بعد. افحص الرسالة وحاول مرة ثانية.'); } catch (cause) { setError(authError(cause)); } finally { setBusy(false); } }}>تحققت من بريدي</button><button className="secondary-button" disabled={busy} onClick={async () => { try { await sendEmailVerification(user); setMessage('أعدنا إرسال رسالة التأكيد.'); } catch (cause) { setError(authError(cause)); } }}>إعادة إرسال الرابط</button><button className="text-button" onClick={() => signOut(auth)}>حساب آخر</button></div>
    {message && <p role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
  </section>;

  return <section className="account-card account-form cloud-auth"><div className="account-medallion"><LockKeyhole size={26} /></div><span className="overline">بوابة المدرسة</span><h2>{mode === 'register' ? 'إنشاء حساب' : mode === 'reset' ? 'استعادة كلمة المرور' : 'تسجيل الدخول'}</h2><p>الطالب ينشئ حسابه، والأستاذ يسجّل ببريده الذي تعتمده الإدارة.</p>
    <div className="account-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>تسجيل الدخول</button><button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>إنشاء حساب</button></div>
    <form onSubmit={submit}>{mode === 'register' && <label>الاسم الكامل<input value={name} onChange={e => setName(e.target.value)} required maxLength="70" autoComplete="name" /></label>}
      <label>البريد الإلكتروني<input dir="ltr" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
      {mode !== 'reset' && <label>كلمة المرور<input dir="ltr" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={mode === 'register' ? 8 : 1} required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-note" role="status">{message}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'جارٍ التنفيذ…' : mode === 'register' ? 'إنشاء الحساب' : mode === 'reset' ? 'إرسال رابط الاستعادة' : 'دخول'}</button>
    </form>
    <button className="text-button cloud-forgot" onClick={() => { setMode(mode === 'reset' ? 'login' : 'reset'); setError(''); setMessage(''); }}>{mode === 'reset' ? 'العودة للدخول' : 'نسيت كلمة المرور؟'}</button>
    <p className="account-notice">إذا كنت أستاذًا، استخدم البريد نفسه الذي سجّلته الإدارة. لا يمكن اختيار صلاحية أستاذ من صفحة التسجيل.</p>
  </section>;
}
