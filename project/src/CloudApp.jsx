import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { BookOpen, GraduationCap, LogOut, Moon, Sun, UserRound, Users, Plus, Headphones, MessagesSquare, X, Trash2, ArrowRight, FileText } from 'lucide-react';
import { auth } from './firebase.js';
import CloudAccount from './CloudAccount.jsx';
import Channels from './Channels.jsx';
import { createChannel, createPost, formatDate, identifyUser, joinChannel, leaveChannel, removeChannel, removeLecture, removePost, saveInvite, saveLecture, watchChannels, watchInvites, watchJoined, watchLectures, watchPosts } from './cloudData.js';
import './cloud.css';

const SCHOOL = 'مدرسة الشيخ محمد حسين الكاظمي';

export default function CloudApp() {
  const [user, setUser] = useState(undefined);
  const [identity, setIdentity] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState('home');
  const [channels, setChannels] = useState([]);
  const [posts, setPosts] = useState({});
  const [joined, setJoined] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [invites, setInvites] = useState([]);
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('hawza-cloud-dark') === '1'; } catch { return false; } });
  const [editingLecture, setEditingLecture] = useState(undefined);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => onAuthStateChanged(auth, current => { setUser(current); setIdentity(null); setError(''); setPage('home'); }), []);
  useEffect(() => {
    if (!user?.emailVerified) return;
    let alive = true;
    identifyUser(user).then(info => { if (alive) setIdentity(info); }).catch(() => { if (alive) setError('تعذر قراءة صلاحيات الحساب. تأكد من نشر قواعد Firestore والإعدادات.'); });
    return () => { alive = false; };
  }, [user?.uid, user?.emailVerified]);
  useEffect(() => { try { localStorage.setItem('hawza-cloud-dark', dark ? '1' : '0'); } catch { /* Optional appearance. */ } }, [dark]);
  useEffect(() => {
    if (!identity || !user) return;
    const fail = () => setError('تعذر قراءة البيانات. تحقق من اتصال الإنترنت وقواعد قاعدة البيانات.');
    const unsubscribe = [watchChannels(setChannels, fail), watchLectures(setLectures, fail)];
    if (identity.role === 'admin') unsubscribe.push(watchInvites(setInvites, fail));
    if (identity.role === 'student') unsubscribe.push(watchJoined(user.uid, setJoined, fail));
    return () => unsubscribe.forEach(stop => stop());
  }, [user?.uid, identity?.role]);
  const visibleChannelIds = useMemo(() => channels.filter(channel => identity?.role === 'admin' || (identity?.role === 'teacher' && channel.ownerId === user?.uid) || joined.includes(channel.id)).map(channel => channel.id), [channels, identity?.role, user?.uid, joined]);
  useEffect(() => {
    if (!identity) return;
    const unsubscribe = visibleChannelIds.map(id => watchPosts(id, current => setPosts(old => ({ ...old, [id]: current })), () => setError('تعذر عرض منشورات إحدى القنوات.')));
    return () => unsubscribe.forEach(stop => stop());
  }, [identity?.role, visibleChannelIds.join('|')]);
  const say = message => { setToast(message); setTimeout(() => setToast(''), 3800); };
  const attempt = async (action, success) => { try { setError(''); const result = await action(); if (success) say(success); return result; } catch (cause) { setError(cause.message || 'تعذر تنفيذ العملية.'); throw cause; } };
  const role = identity?.role;
  const isTeacher = role === 'teacher';
  const mine = lectures.filter(item => item.ownerId === user?.uid);
  const listed = isTeacher ? mine : lectures;
  const displayChannels = channels.map(channel => ({ ...channel, posts: posts[channel.id] || [] }));

  if (user === undefined || (user?.emailVerified && !identity && !error)) return <div className="app cloud-loading">جارٍ تحميل حساب المدرسة…</div>;
  if (!user || !user.emailVerified) return <div className={`app ${dark ? 'dark' : ''}`}><div className="entry entry-account"><main className="entry-main"><div className="entry-top"><Brand /><button className="icon-button" onClick={() => setDark(!dark)} aria-label="تبديل المظهر">{dark ? <Sun /> : <Moon />}</button></div><div className="entry-content"><CloudAccount user={user} onVerified={() => { setIdentity(null); identifyUser(auth.currentUser).then(setIdentity).catch(() => setError('تعذر قراءة صلاحية الحساب.')); }} /></div><footer className="entry-footer">{SCHOOL}</footer></main></div></div>;
  if (!identity) return <div className="app cloud-loading"><p>{error}</p><button className="secondary-button" onClick={() => signOut(auth)}>تسجيل الخروج</button></div>;

  const tabs = role === 'admin' ? [['home', 'الرئيسية', BookOpen], ['teachers', 'الأساتذة', Users], ['account', 'الحساب', UserRound]] : role === 'teacher' ? [['home', 'الرئيسية', BookOpen], ['channels', 'قنوات المواد', MessagesSquare], ['lectures', 'المحاضرات', Headphones], ['account', 'الحساب', UserRound]] : [['home', 'الرئيسية', BookOpen], ['channels', 'قنوات المواد', MessagesSquare], ['lectures', 'المحاضرات', Headphones], ['account', 'الحساب', UserRound]];
  const title = { home: 'الرئيسية', teachers: 'إدارة الأساتذة', channels: 'قنوات المواد', lectures: 'المحاضرات', account: 'الحساب' }[page];
  return <div className={`app cloud-app ${dark ? 'dark' : ''}`}><div className="workspace"><aside className="sidebar"><div className="sidebar-head"><Brand /></div><span className="side-caption">القائمة الرئيسية</span><nav className="side-nav">{tabs.map(([id, label, Icon]) => <button key={id} onClick={() => { setPage(id); setSelectedLecture(null); setError(''); }} className={`side-link ${page === id ? 'active' : ''}`}><Icon size={19} />{label}</button>)}</nav><div className="sidebar-bottom"><div className="school-mark"><span>المنصة التعليمية</span><strong>{SCHOOL}</strong></div><button className="side-link" onClick={() => setDark(!dark)}>{dark ? <Sun size={19} /> : <Moon size={19} />}{dark ? 'الوضع الفاتح' : 'الوضع الداكن'}</button><button className="side-link logout" onClick={() => signOut(auth)}><LogOut size={19} />تسجيل الخروج</button></div></aside>
    <div className="content-wrap"><header className="topbar"><div className="topbar-start"><span className="topbar-title">{SCHOOL}</span></div><div className="topbar-end"><span className="demo-pill">حساب المدرسة</span><div className="avatar">{identity.name?.[0] || 'ح'}</div></div></header><main className="main-content"><div className="page-heading"><div><span className="overline">{role === 'admin' ? 'الإدارة' : role === 'teacher' ? 'الأستاذ' : 'الطالب'} / {title}</span><h2>{title}</h2></div></div>{error && <div className="cloud-error" role="alert">{error}<button aria-label="إغلاق التنبيه" onClick={() => setError('')}><X size={17} /></button></div>}
      {page === 'home' && <><div className="welcome-banner"><div><span className="welcome-kicker">مرحبًا، {identity.name}</span><h3>{role === 'admin' ? 'إدارة أساتذة المدرسة' : role === 'teacher' ? 'موادك ومحاضراتك' : 'تابع موادك وقنواتك'}</h3><p>{role === 'admin' ? 'اعتمد بريد الأستاذ وحدد مواده من لوحة الإدارة.' : role === 'teacher' ? 'انشر الدروس والقنوات في المواد التي اعتمدتها الإدارة.' : 'ابحث عن قناة أستاذك واطلع على المحاضرات المنشورة.'}</p><button onClick={() => setPage(role === 'admin' ? 'teachers' : role === 'teacher' ? 'lectures' : 'channels')}>{role === 'admin' ? 'إدارة الأساتذة' : role === 'teacher' ? 'محاضراتي' : 'قنوات المواد'}</button></div><div className="arch-motif" aria-hidden="true"><GraduationCap size={48} /></div></div>{role === 'teacher' && <p className="scope-note">المواد المعتمدة لك: {identity.subjects.join('، ') || 'لا توجد مادة مخصصة بعد'}</p>}<div className="cloud-shortcuts">{(role === 'admin' ? [['الأساتذة', 'teachers', Users]] : [['قنوات المواد', 'channels', MessagesSquare], ['المحاضرات', 'lectures', Headphones]]).map(([name, id, Icon]) => <button key={id} onClick={() => setPage(id)} className="channel-home-link"><Icon size={24} /><strong>{name}</strong></button>)}</div></>}
      {page === 'teachers' && role === 'admin' && <TeacherManagement invites={invites} onSave={data => attempt(() => saveInvite(data), 'حُفظت بيانات الأستاذ')} />}
      {page === 'channels' && role !== 'admin' && <Channels role={role} userId={user.uid} channels={displayChannels} joined={joined} allowedSubjects={isTeacher ? identity.subjects : undefined}
        onCreate={data => attempt(() => createChannel(user, data, identity.name), 'أُنشئت القناة')}
        onJoin={id => attempt(() => joinChannel(user.uid, id), 'انضممت إلى القناة').catch(() => {})}
        onLeave={id => attempt(() => leaveChannel(user.uid, id), 'غادرت القناة').catch(() => {})}
        onPost={(id, post) => attempt(() => createPost(user, id, post), 'نُشر المنشور')}
        onDeletePost={(id, postId) => { const post = (posts[id] || []).find(item => item.id === postId); if (post && window.confirm('حذف هذا المنشور؟')) attempt(() => removePost(id, post), 'حُذف المنشور').catch(() => {}); }}
        onDeleteChannel={async channel => { if (!window.confirm(`حذف قناة «${channel.name}» ومنشوراتها؟`)) return false; await attempt(() => removeChannel(channel), 'حُذفت القناة'); return true; }} />}
      {page === 'lectures' && role !== 'admin' && (selectedLecture ? <LectureView lecture={lectures.find(item => item.id === selectedLecture) || selectedLecture} onBack={() => setSelectedLecture(null)} /> : <section className="section-block cloud-lectures"><div className="section-head"><div><h3>{isTeacher ? 'محاضراتي' : 'المواد والمحاضرات'}</h3><p>{listed.length} محاضرات</p></div>{isTeacher && <button className="primary-button" onClick={() => setEditingLecture(null)}><Plus size={17} /> إضافة محاضرة</button>}</div>{isTeacher && editingLecture !== undefined && <LectureForm initial={editingLecture} subjects={identity.subjects} onCancel={() => setEditingLecture(undefined)} onSave={async data => { await attempt(() => saveLecture(user, data, editingLecture, identity.name), 'حُفظت المحاضرة'); setEditingLecture(undefined); }} />}{listed.length ? <div className="lecture-stack">{listed.map(item => <article className="lecture-row" key={item.id}><div className="round-icon mint"><BookOpen size={21} /></div><button className="lecture-main" onClick={() => setSelectedLecture(item.id)}><strong>{item.title}</strong><span>{item.subject} · {item.book} · {item.date}</span></button>{isTeacher && <><button className="row-action" onClick={() => setEditingLecture(item)}>تعديل</button><button className="row-action danger-text" onClick={() => { if (window.confirm('حذف هذه المحاضرة؟')) attempt(() => removeLecture(item), 'حُذفت المحاضرة').catch(() => {}); }} aria-label="حذف المحاضرة"><Trash2 size={16} /></button></>}</article>)}</div> : <p className="quiet-empty">لا توجد محاضرات منشورة بعد.</p>}</section>)}
      {page === 'account' && <section className="account-card"><span className="overline">حساب المدرسة</span><h3>{identity.name}</h3><p>{role === 'admin' ? 'مدير المدرسة' : role === 'teacher' ? 'أستاذ معتمد' : 'طالب'}</p><p dir="ltr">{user.email}</p>{isTeacher && <p className="account-notice">المواد المعتمدة: {identity.subjects.join('، ')}</p>}<button className="secondary-button" onClick={() => signOut(auth)}>تسجيل الخروج</button></section>}
      <footer className="site-footer">{SCHOOL}</footer></main></div></div>{toast && <div role="status" className="toast">{toast}</div>}</div>;
}

function Brand() { return <div className="brand"><div className="brand-icon"><BookOpen size={22} /></div><div><strong>مدرسة الشيخ محمد حسين</strong><span>الكاظمي</span></div></div>; }

function TeacherManagement({ invites, onSave }) {
  const [editing, setEditing] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [subjects, setSubjects] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const open = item => { setEditing(item?.email || null); setEmail(item?.email || ''); setName(item?.name || ''); setSubjects(item?.subjects?.join('، ') || ''); setActive(item?.active ?? true); setError(''); };
  const submit = async e => { e.preventDefault(); setBusy(true); setError(''); try { await onSave({ email, name, subjects: subjects.split(/[,،\n]/).map(s => s.trim()).filter(Boolean), active }); open(null); } catch (cause) { setError(cause.message); } finally { setBusy(false); } };
  return <div className="cloud-admin"><section className="section-block"><div className="section-head"><div><h3>الأساتذة المعتمدون</h3><p>يستطيع الأستاذ التسجيل ببريده بعد إضافته هنا وتأكيده.</p></div><button className="primary-button" onClick={() => open({})}><Plus size={17} /> إضافة أستاذ</button></div>{invites.length ? <div className="lecture-stack">{invites.map(item => <article className="lecture-row" key={item.email}><div className="round-icon mint"><Users size={20} /></div><div className="lecture-main"><strong>{item.name} {item.active ? '' : '· موقوف'}</strong><span dir="ltr">{item.email}</span><small>{item.subjects?.join('، ')}</small></div><button className="row-action" onClick={() => open(item)}>تعديل</button></article>)}</div> : <p className="quiet-empty">لم تُضف أي أستاذ بعد.</p>}</section>
    {editing !== null && <section className="section-block cloud-invite-form"><div className="section-head"><h3>{editing ? 'تعديل صلاحيات الأستاذ' : 'إضافة أستاذ'}</h3><button className="icon-button" onClick={() => setEditing(null)} aria-label="إغلاق"><X /></button></div><form onSubmit={submit}><label>اسم الأستاذ<input value={name} onChange={e => setName(e.target.value)} maxLength="70" required /></label><label>بريد الأستاذ<input value={email} onChange={e => setEmail(e.target.value)} dir="ltr" type="email" required readOnly={Boolean(editing)} /></label><label>المواد المعتمدة <small>افصل بينها بفاصلة</small><textarea value={subjects} onChange={e => setSubjects(e.target.value)} placeholder="الفقه، الأصول" required /></label><label className="cloud-check"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> الحساب فعّال</label>{error && <p role="alert" className="form-error">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setEditing(null)}>إلغاء</button><button className="primary-button" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ الأستاذ'}</button></div></form><p className="form-note">لا ترسل كلمة مرور للأستاذ؛ يفتح الموقع ويسجّل بهذا البريد ويؤكده بنفسه.</p></section>}
  </div>;
}

function LectureForm({ initial, subjects, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [subject, setSubject] = useState(initial?.subject || subjects[0] || '');
  const [book, setBook] = useState(initial?.book || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [audio, setAudio] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { await onSave({ title, subject, book, description, audio, pdf }); } catch (cause) { setError(cause.message || 'تعذر حفظ المحاضرة.'); } finally { setBusy(false); } }
  return <form className="cloud-lecture-form" onSubmit={submit}><label>عنوان المحاضرة<input value={title} onChange={e => setTitle(e.target.value)} required maxLength="100" /></label><label>المادة<select value={subject} onChange={e => setSubject(e.target.value)} required disabled={Boolean(initial)}>{subjects.map(item => <option key={item}>{item}</option>)}</select></label><label>الكتاب<input value={book} onChange={e => setBook(e.target.value)} required maxLength="100" /></label><label>وصف مختصر<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength="500" /></label><div className="cloud-files"><label>تسجيل صوتي <input type="file" accept="audio/*" onChange={e => setAudio(e.target.files[0] || null)} /></label><label>ملف PDF <input type="file" accept="application/pdf" onChange={e => setPdf(e.target.files[0] || null)} /></label></div>{error && <p role="alert" className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onCancel}>إلغاء</button><button className="primary-button" disabled={busy || !subjects.length}>{busy ? 'جارٍ الحفظ…' : 'حفظ المحاضرة'}</button></div></form>;
}

function LectureView({ lecture, onBack }) {
  return <section className="section-block cloud-lecture-view"><button className="back-button" onClick={onBack}><ArrowRight size={18} /> المحاضرات</button><span className="overline">{lecture.subject} · {lecture.book}</span><h2>{lecture.title}</h2><p>{lecture.description}</p><span className="scope-note">{lecture.teacherName} · {lecture.date || formatDate(lecture.createdAt)}</span>{lecture.audioUrl && <audio controls preload="metadata" src={lecture.audioUrl} />}{lecture.pdfUrl && <a className="outline-button" href={lecture.pdfUrl} target="_blank" rel="noreferrer"><FileText size={18} /> عرض ملف PDF</a>}{!lecture.audioUrl && !lecture.pdfUrl && <p className="quiet-empty">لم تُرفق ملفات بهذه المحاضرة.</p>}</section>;
}
