import { useState } from 'react';
import { LockKeyhole, Mail, UserRound } from 'lucide-react';
import './account.css';

const ACCOUNTS_KEY = 'hawza-demo-accounts-v1';
export const SESSION_KEY = 'hawza-demo-session-v1';
const readAccounts = () => { try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || []; } catch { return []; } };
const bytesToHex = bytes => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');

async function passwordHash(password, salt) {
  if (!crypto.subtle) throw new Error('هذا المتصفح لا يدعم حفظ حسابات المعاينة. افتح الملف بمتصفح حديث.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: Uint8Array.from(salt.match(/.{2}/g).map(pair => parseInt(pair, 16))), iterations: 120000, hash: 'SHA-256' }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

export default function Account({ user, onLogin, onLogout }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const address = email.trim().toLowerCase();
      const accounts = readAccounts();
      if (mode === 'register') {
        if (!name.trim()) throw new Error('اكتب اسمك.');
        if (password.length < 8) throw new Error('كلمة المرور لازم تكون ٨ أحرف على الأقل.');
        if (accounts.some(account => account.email === address)) throw new Error('هذا البريد مسجل مسبقًا في هذا المتصفح.');
        const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
        const hash = await passwordHash(password, salt);
        const account = { id: crypto.randomUUID(), name: name.trim(), email: address, role, salt, hash };
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, account]));
        onLogin({ id: account.id, name: account.name, email: account.email, role: account.role });
      } else {
        const account = accounts.find(item => item.email === address);
        if (!account || await passwordHash(password, account.salt) !== account.hash) throw new Error('البريد أو كلمة المرور غير صحيحة.');
        onLogin({ id: account.id, name: account.name, email: account.email, role: account.role });
      }
      setPassword('');
    } catch (cause) { setError(cause.message || 'تعذر إكمال العملية. تحقق من سماح المتصفح بالتخزين.'); }
    finally { setBusy(false); }
  };

  if (user) return <section className="account-card"><div className="account-medallion"><UserRound size={27} /></div><span className="overline">الحساب الشخصي</span><h3>{user.name}</h3><p>{user.role === 'teacher' ? 'حساب أستاذ تجريبي' : 'حساب طالب تجريبي'}</p><div className="account-detail"><Mail size={17} /><span dir="ltr">{user.email}</span></div><p className="account-notice">هذا الحساب محفوظ في هذا المتصفح فقط. صلاحيات الأستاذ وربط البيانات بين الأجهزة يتطلبان خادمًا وحسابات معتمدة من المدرسة.</p><button className="secondary-button" onClick={onLogout}>تسجيل الخروج</button></section>;

  return <section className="account-card account-form"><div className="account-medallion"><LockKeyhole size={27} /></div><span className="overline">بوابة الحساب</span><h2>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب للمعاينة'}</h2><p>ادخل إلى مساحة الطالب أو الأستاذ لمتابعة القنوات والمحاضرات.</p>
    <div className="account-tabs"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>تسجيل الدخول</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>إنشاء حساب</button></div>
    <form onSubmit={submit}>
      {mode === 'register' && <label>الاسم الكامل<input value={name} onChange={event => setName(event.target.value)} required maxLength="70" autoComplete="name" placeholder="اسم الطالب أو الأستاذ" /></label>}
      <label>البريد الإلكتروني<input dir="ltr" type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" placeholder="name@example.com" /></label>
      <label>كلمة المرور<input dir="ltr" type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="أدخل كلمة المرور" /></label>
      {mode === 'register' && <label>نوع الحساب<select value={role} onChange={event => setRole(event.target.value)}><option value="student">طالب</option><option value="teacher">أستاذ</option></select></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? 'جارٍ التحقق…' : mode === 'login' ? 'دخول' : 'إنشاء الحساب والدخول'}</button>
    </form>
    <p className="account-notice">معاينة محلية: الحساب والبيانات على هذا الجهاز فقط. يستطيع أي شخص إنشاء حساب أستاذ هنا؛ تفعيل الصلاحيات الفعلية يحتاج اعتماد المدرسة وربط الخادم.</p>
  </section>;
}
