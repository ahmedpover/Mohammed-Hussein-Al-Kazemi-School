import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bell, BookOpen, Bookmark, Check, ChevronLeft,
  Clock3, FileText, GraduationCap, Headphones, Home, LogOut, Menu,
  MessagesSquare, Moon, Plus, Search, ShieldCheck, Sun, Trash2, UploadCloud, UserRound, X
} from 'lucide-react';
import { getAttachment, removeAttachments, saveAttachment } from './demoStore.js';
import Channels from './Channels.jsx';
import Account, { SESSION_KEY } from './Account.jsx';

const SCHOOL = 'مدرسة الشيخ محمد حسين الكاظمي';
const LEGACY_SUBJECTS = { fiqh: 'الفقه', usul: 'أصول الفقه', aqida: 'العقائد' };
const subjectName = name => LEGACY_SUBJECTS[name] || name || 'مادة غير محددة';
const subjectKey = lecture => `${subjectName(lecture.subject)}\u0000${lecture.book || ''}`;
const NAV_STUDENT = [
  { id: 'home', label: 'الرئيسية', icon: Home }, { id: 'subjects', label: 'المواد الدراسية', icon: BookOpen },
  { id: 'channels', label: 'قنوات المواد', icon: MessagesSquare },
  { id: 'favorites', label: 'المفضلة', icon: Bookmark }, { id: 'history', label: 'سجل المشاهدة', icon: Clock3 },
  { id: 'notifications', label: 'الإشعارات', icon: Bell }, { id: 'account', label: 'الحساب', icon: UserRound },
];
const NAV_TEACHER = [
  { id: 'home', label: 'الرئيسية', icon: Home }, { id: 'lectures', label: 'المحاضرات', icon: Headphones },
  { id: 'channels', label: 'قنوات المواد', icon: MessagesSquare },
  { id: 'notifications', label: 'الإشعارات', icon: Bell }, { id: 'account', label: 'الحساب', icon: UserRound },
];

function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeLocal(key, value) { try { localStorage.setItem(key, value); } catch { /* Preview still runs when file storage is blocked. */ } }
function removeLocal(key) { try { localStorage.removeItem(key); } catch { /* Optional playback position. */ } }
function subjectFor(id) { return { name: subjectName(id), color: 'mint' }; }
function IconButton({ icon: Icon, label, onClick, className = '', pressed }) {
  return <button type="button" className={`icon-button ${className}`} onClick={onClick} aria-label={label} aria-pressed={pressed}><Icon size={19} strokeWidth={1.8} /></button>;
}

export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch { return null; } });
  const role = user?.role || null;
  const login = account => { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(account)); } catch { /* Session stays in memory. */ } setUser(account); setPage('home'); }; 
  const [page, setPage] = useState('home');
  const [selected, setSelected] = useState(null);
  const [subject, setSubject] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [dark, setDark] = useState(() => readLocal('hawza-formal-theme-v3', false));
  const [notes, setNotes] = useState(() => readLocal('hawza-notes', {}));
  const [favorites, setFavorites] = useState(() => readLocal('hawza-favorites', []));
  const [history, setHistory] = useState(() => readLocal('hawza-history', []));
  const [lectures, setLectures] = useState(() => readLocal('hawza-created-lectures-v2', []));
  const [announcements, setAnnouncements] = useState(() => readLocal('hawza-announcements-v2', []));
  const [channels, setChannels] = useState(() => readLocal('hawza-channels-v1', []));
  const [joinedByUser, setJoinedByUser] = useState(() => readLocal('hawza-joined-by-user-v2', {}));
  const joinedChannels = joinedByUser[user?.id] || [];
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [noticeForm, setNoticeForm] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => { writeLocal('hawza-formal-theme-v3', JSON.stringify(dark)); }, [dark]);
  useEffect(() => { writeLocal('hawza-notes', JSON.stringify(notes)); }, [notes]);
  useEffect(() => { writeLocal('hawza-favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { writeLocal('hawza-history', JSON.stringify(history)); }, [history]);
  useEffect(() => {
    writeLocal('hawza-created-lectures-v2', JSON.stringify(lectures.filter(l => !l.sample).map(({ audioUrl, pdfUrl, ...data }) => data)));
  }, [lectures]);
  useEffect(() => { writeLocal('hawza-announcements-v2', JSON.stringify(announcements)); }, [announcements]);
  useEffect(() => {
    writeLocal('hawza-channels-v1', JSON.stringify(channels.map(channel => ({ ...channel, posts: (channel.posts || []).map(({ imageUrl, ...post }) => post) }))));
  }, [channels]);
  useEffect(() => { writeLocal('hawza-joined-by-user-v2', JSON.stringify(joinedByUser)); }, [joinedByUser]);
  useEffect(() => {
    let mounted = true;
    const posts = channels.flatMap(channel => channel.posts || []).filter(post => post.imageName);
    Promise.all(posts.map(async post => {
      try {
        const file = await getAttachment(post.id, 'image');
        return file ? { id: post.id, url: URL.createObjectURL(file) } : null;
      } catch { return null; }
    })).then(items => {
      if (!mounted) return;
      setChannels(old => old.map(channel => ({ ...channel, posts: (channel.posts || []).map(post => {
        const match = items.find(item => item?.id === post.id);
        return match ? { ...post, imageUrl: match.url } : post;
      }) })));
    });
    return () => { mounted = false; };
  // Restore image attachments once when the preview starts.
  }, []);
  useEffect(() => {
    let mounted = true;
    const created = lectures.filter(l => !l.sample);
    Promise.all(created.map(async lecture => {
      try {
        const [audio, pdf] = await Promise.all([getAttachment(lecture.id, 'audio'), getAttachment(lecture.id, 'pdf')]);
        return { id: lecture.id, audioUrl: audio ? URL.createObjectURL(audio) : null, pdfUrl: pdf ? URL.createObjectURL(pdf) : null };
      } catch { return null; }
    })).then(results => {
      if (!mounted) return;
      setLectures(old => old.map(l => {
        const media = results.find(item => item?.id === l.id);
        return media ? { ...l, audioUrl: media.audioUrl || l.audioUrl, pdfUrl: media.pdfUrl || l.pdfUrl } : l;
      }));
    });
    return () => { mounted = false; };
  // Restore attachments only once when the preview starts.
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const flash = (message) => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 3600); };
  const go = (destination) => { setPage(destination); setSubject(null); setSelected(null); setDrawer(false); setQuery(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const openLecture = (lecture) => {
    setSelected(lecture); setDrawer(false);
    setHistory(old => [lecture.id, ...old.filter(id => id !== lecture.id)].slice(0, 30));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const logout = () => { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Optional session. */ } setUser(null); setPage('home'); setSelected(null); setDrawer(false); window.scrollTo(0, 0); };
  const toggleFavorite = (id) => setFavorites(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
  const saveLecture = async data => {
    const { audioFile, pdfFile, ...metadata } = data;
    let mediaSaved = true;
    try {
      await Promise.all([
        audioFile && saveAttachment(metadata.id, 'audio', audioFile),
        pdfFile && saveAttachment(metadata.id, 'pdf', pdfFile),
      ]);
    } catch { mediaSaved = false; }
    const lecture = {
      ...metadata,
      audioUrl: audioFile ? URL.createObjectURL(audioFile) : editing?.audioUrl || null,
      pdfUrl: pdfFile ? URL.createObjectURL(pdfFile) : editing?.pdfUrl || null,
    };
    setLectures(old => editing ? old.map(l => l.id === editing.id ? lecture : l) : [lecture, ...old]);
    setShowCreate(false); setEditing(null);
    flash(mediaSaved ? (editing ? 'حُفظت تعديلات المحاضرة' : 'أُضيفت المحاضرة وحُفظت في هذا المتصفح') : 'حُفظت بيانات المحاضرة؛ الملف يعمل حتى تغلق الصفحة فقط');
    go('lectures');
  };
  const deleteLecture = async id => {
    if (!window.confirm('حذف هذه المحاضرة وملفاتها من المعاينة؟')) return;
    setLectures(old => old.filter(l => l.id !== id));
    setFavorites(old => old.filter(item => item !== id));
    setHistory(old => old.filter(item => item !== id));
    try { await removeAttachments(id); } catch { /* Browsers can block local file storage. */ }
    flash('حُذفت المحاضرة من المعاينة');
  };
  const publishPost = async (channelId, { image, ...post }) => {
    let saved = true;
    if (image) {
      try { await saveAttachment(post.id, 'image', image); }
      catch { saved = false; }
    }
    const published = { ...post, imageName: image?.name || null, imageUrl: image ? URL.createObjectURL(image) : null };
    setChannels(old => old.map(channel => channel.id === channelId ? { ...channel, posts: [published, ...(channel.posts || [])] } : channel));
    flash(saved ? 'نُشر المنشور في معاينة القناة' : 'نُشر المنشور؛ قد تختفي صورته عند إعادة تحميل الصفحة');
  };
  const deletePost = async (channelId, postId) => {
    if (!window.confirm('حذف هذا المنشور؟')) return;
    setChannels(old => old.map(channel => channel.id === channelId ? { ...channel, posts: (channel.posts || []).filter(post => post.id !== postId) } : channel));
    try { await removeAttachments(postId, ['image']); } catch { /* Storage may be unavailable in direct file preview. */ }
    flash('حُذف المنشور');
  };
  const deleteChannel = async channel => {
    if (!window.confirm(`حذف قناة «${channel.name}» وكل منشوراتها؟`)) return false;
    setChannels(old => old.filter(item => item.id !== channel.id));
    setJoinedByUser(old => Object.fromEntries(Object.entries(old).map(([id, joined]) => [id, joined.filter(item => item !== channel.id)])));
    for (const post of channel.posts || []) {
      try { await removeAttachments(post.id, ['image']); } catch { /* Optional local storage. */ }
    }
    flash('حُذفت القناة');
    return true;
  };
  const matches = useMemo(() => lectures.filter(l => {
    const text = `${l.title} ${subjectName(l.subject)} ${l.book || ''} ${l.description}`;
    return text.includes(query.trim());
  }), [lectures, query]);
  const nav = role === 'teacher' ? NAV_TEACHER : NAV_STUDENT;

  if (!role) return <div className={dark ? 'app dark' : 'app'}>
    <div className={`entry ${page === 'account' ? 'entry-account' : ''}`}>
      {page !== 'account' && <div className="entry-visual" role="img" aria-label="صورة مبنى مدرسة الشيخ محمد حسين الكاظمي" />}
      <main className="entry-main">
        <div className="entry-top"><Brand /><IconButton icon={dark ? Sun : Moon} label={dark ? 'الوضع الفاتح' : 'الوضع الداكن'} onClick={() => setDark(!dark)} /></div>
        <div className="entry-content">
          <span className="eyebrow"><span className="eyebrow-line" /> المنصة التعليمية</span>
          {page !== 'account' && <><h1>مدرسة الشيخ<br /><span>محمد حسين الكاظمي</span></h1><p>محاضراتك وموادك وملاحظاتك في مكان واحد، أينما كنت.</p></>}
          {page === 'account' ? <Account onLogin={login} /> : <div className="entry-actions">
            <button className="primary-button" onClick={() => go('account')}>تسجيل الدخول أو إنشاء حساب <ArrowLeft size={18} /></button>
          </div>}
          <div className="preview-note"><ShieldCheck size={17} /><span>هذه نسخة معاينة للتصميم والوظائف المحلية. الحسابات هنا تجريبية ومحلية على جهازك؛ ربطها بالمدرسة قيد الإعداد.</span></div>
        </div>
        <div className="entry-footer">بوابة تعليمية خاصة بطلاب المدرسة وأساتذتها</div>
      </main>
    </div>
  </div>;

  const heading = selected ? selected.title : subject ? subject.split('\u0000')[0] : ({ home: 'الرئيسية', subjects: 'المواد الدراسية', channels: 'قنوات المواد', favorites: 'المفضلة', history: 'سجل المشاهدة', notifications: 'الإشعارات', lectures: 'المحاضرات', account: 'الحساب' })[page];
  return <div className={dark ? 'app dark' : 'app'}>
    <div className="workspace">
      {drawer && <button className="scrim" aria-label="إغلاق القائمة" onClick={() => setDrawer(false)} />}
      <aside className={`sidebar ${drawer ? 'sidebar-open' : ''}`}>
        <div className="sidebar-head"><Brand /><IconButton icon={X} label="إغلاق القائمة" className="sidebar-close" onClick={() => setDrawer(false)} /></div>
        <div className="side-caption">القائمة الرئيسية</div>
        <nav aria-label="التنقل الرئيسي" className="side-nav">{nav.map(({ id, icon: Icon, label }) => <button key={id} className={(page === id && !subject && !selected) ? 'side-link active' : 'side-link'} onClick={() => go(id)}><Icon size={19} strokeWidth={1.8} />{label}{id === 'notifications' && announcements.length > 0 && <span className="nav-count">{announcements.length}</span>}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className="school-mark"><span>المنصة التعليمية</span><strong>مدرسة الشيخ محمد حسين الكاظمي</strong><span className="mark-decoration">✦</span></div>
          <button className="side-link" onClick={() => setDark(!dark)}>{dark ? <Sun size={19} /> : <Moon size={19} />}{dark ? 'الوضع الفاتح' : 'الوضع الداكن'}</button>
          <button className="side-link logout" onClick={logout}><LogOut size={19} />الخروج من المعاينة</button>
        </div>
      </aside>
      <div className="content-wrap">
        <header className="topbar">
          <div className="topbar-start"><IconButton icon={Menu} label="فتح القائمة" className="menu-button" onClick={() => setDrawer(true)} /><span className="topbar-title">{SCHOOL}</span></div>
          <div className="topbar-end"><span className="demo-pill">نسخة معاينة</span><IconButton icon={dark ? Sun : Moon} label="تبديل المظهر" className="topbar-theme" onClick={() => setDark(!dark)} /><div className="avatar" title={role === 'teacher' ? 'معاينة الأستاذ' : 'معاينة الطالب'}>{user.name.trim().slice(0, 1)}</div></div>
        </header>
        <main className="main-content">
          {(subject || selected) && <button className="back-button" onClick={() => selected ? setSelected(null) : setSubject(null)}><ArrowRight size={17} /> رجوع</button>}
          {selected ? <LectureDetail lecture={lectures.find(l => l.id === selected.id) || selected} note={notes[selected.id] || ''} onNote={value => setNotes(old => ({ ...old, [selected.id]: value }))} favorite={favorites.includes(selected.id)} onFavorite={() => toggleFavorite(selected.id)} role={role} flash={flash} /> : <>
            <div className="page-heading"><div><span className="overline">{role === 'teacher' ? 'واجهة الأستاذ' : 'واجهة الطالب'} / {heading}</span><h2>{heading}</h2></div>{role === 'teacher' && (page === 'home' || page === 'lectures') && <button className="primary-button add-button" onClick={() => setShowCreate(true)}><Plus size={18} /> إضافة محاضرة</button>}</div>
            {page === 'home' && !subject && (role === 'teacher' ? <TeacherHome lectures={lectures} onCreate={() => setShowCreate(true)} onOpen={openLecture} onNotifications={() => go('notifications')} onChannels={() => go('channels')} /> : <StudentHome lectures={lectures} onSubject={setSubject} onOpen={openLecture} onAll={() => go('subjects')} onChannels={() => go('channels')} history={history} onFavorites={() => go('favorites')} />)}
            {page === 'account' && <Account user={user} onLogout={logout} />}
            {page === 'channels' && <Channels role={role} userId={user.id} channels={channels} joined={joinedChannels}
              onCreate={channel => { setChannels(old => [{ ...channel, ownerId: user.id }, ...old]); flash('أُنشئت قناة المادة'); }}
              onJoin={id => { setJoinedByUser(old => ({ ...old, [user.id]: old[user.id]?.includes(id) ? old[user.id] : [...(old[user.id] || []), id] })); flash('انضممت إلى القناة'); }}
              onLeave={id => { setJoinedByUser(old => ({ ...old, [user.id]: (old[user.id] || []).filter(item => item !== id) })); flash('غادرت القناة'); }}
              onPost={publishPost} onDeletePost={deletePost} onDeleteChannel={deleteChannel} />}
            {(page === 'subjects' || page === 'lectures' || subject) && <>
              {!subject && page === 'subjects' && <SubjectGrid lectures={lectures} onSubject={setSubject} />}
              {(subject || page === 'lectures') && <LectureList lectures={matches.filter(l => !subject || subjectKey(l) === subject)} role={role} query={query} onQuery={setQuery} onOpen={openLecture} onDelete={deleteLecture} onEdit={lecture => { setEditing(lecture); setShowCreate(true); }} />}
            </>}
            {(page === 'favorites' || page === 'history') && <LectureList lectures={(page === 'favorites' ? lectures.filter(l => favorites.includes(l.id)) : history.map(id => lectures.find(l => l.id === id)).filter(Boolean)).filter(l => !query || l.title.includes(query))} role={role} query={query} onQuery={setQuery} onOpen={openLecture} emptyText={page === 'favorites' ? 'ما أضفت محاضرات إلى المفضلة بعد.' : 'ما فتحت أي محاضرة بعد.'} />}
            {page === 'notifications' && <div className="section-block"><div className="section-head"><div><h3>آخر الإشعارات</h3><p>التنبيهات المنشورة ضمن المعاينة</p></div>{role === 'teacher' && <button className="outline-button" onClick={() => setNoticeForm(true)}><Plus size={17} /> إضافة إشعار</button>}</div>{announcements.length ? <div className="announcement-list">{announcements.map(a => <article className="announcement" key={a.id}><div className="round-icon mint"><Bell size={20} /></div><div><h4>{a.title}</h4><p>{a.body}</p><small>{a.date}</small></div></article>)}</div> : <Empty icon={Bell} text="لا توجد إشعارات منشورة حاليًا." />}</div>}
          </>}
          <footer className="site-footer">{SCHOOL} <span>·</span> نسخة معاينة محلية</footer>
        </main>
      </div>
    </div>
    {showCreate && <CreateLecture initial={editing} onClose={() => { setShowCreate(false); setEditing(null); }} onSave={saveLecture} />}
    {noticeForm && <CreateNotice onClose={() => setNoticeForm(false)} onSave={notice => { setAnnouncements(old => [notice, ...old]); setNoticeForm(false); flash('نُشر الإشعار في المعاينة'); }} />}
    {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}
  </div>;
}

function Brand() { return <div className="brand"><div className="brand-icon"><BookOpen size={22} strokeWidth={1.65} /></div><div><strong>مدرسة الشيخ محمد حسين</strong><span>الكاظمي</span></div></div>; }
function Empty({ icon: Icon, text }) { return <div className="empty"><div className="empty-icon"><Icon size={26} strokeWidth={1.5} /></div><p>{text}</p></div>; }
function SubjectGrid({ lectures, onSubject }) { const subjects = [...new Map(lectures.map(lecture => [subjectKey(lecture), { subject: subjectName(lecture.subject), book: lecture.book || '', key: subjectKey(lecture) }])).values()]; return subjects.length ? <div className="subject-grid">{subjects.map(item => <button className="subject-card" key={item.key} onClick={() => onSubject(item.key)}><div className="subject-icon mint"><BookOpen size={26} strokeWidth={1.6} /></div><h3>{item.subject}</h3><p>{item.book || 'لم يُذكر الكتاب'}</p><div className="subject-bottom"><span>{lectures.filter(l => subjectKey(l) === item.key).length} محاضرات</span><ArrowLeft size={18} /></div></button>)}</div> : <Empty icon={BookOpen} text="لا توجد مواد بعد. تظهر هنا مواد المحاضرات التي يضيفها الأستاذ." />; }
function StudentHome({ lectures, onSubject, onOpen, onAll, onChannels, history, onFavorites }) {
  const last = history.map(id => lectures.find(l => l.id === id)).find(Boolean);
  return <>
    <div className="welcome-banner"><div><span className="welcome-kicker">مرحبًا بك في مدرستك</span><h3>ابدأ من حيث وصلت، أو اختر مادة جديدة</h3><p>دروسك وملاحظاتك مرتّبة أمامك لتتابع دراستك بسهولة.</p><button onClick={onAll}>تصفح المواد <ArrowLeft size={17} /></button></div><div className="arch-motif" aria-hidden="true"><BookOpen size={46} strokeWidth={1.1} /></div></div>
    <div className="section-head first-section"><div><h3>المواد الدراسية</h3><p>اختر المادة للاطلاع على محاضراتها</p></div><button className="text-button" onClick={onAll}>عرض الكل <ArrowLeft size={16} /></button></div>
    <SubjectGrid lectures={lectures} onSubject={onSubject} />
    <button className="channel-home-link" onClick={onChannels}><div className="round-icon gold"><MessagesSquare size={21} /></div><span><strong>قنوات المواد</strong><small>ابحث عن معرّف قناة أستاذك وتابع منشوراته</small></span><ArrowLeft size={19} /></button>
    <div className="section-head extra-section"><div><h3>آخر ما فتحته</h3><p>تابع من آخر محاضرة زرتها</p></div><button className="text-button" onClick={onFavorites}>المفضلة <Bookmark size={16} /></button></div>
    {last ? <div className="resume-card" onClick={() => onOpen(last)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen(last)}><div className="round-icon mint"><Headphones size={21} /></div><div><strong>{last.title}</strong><span>{subjectName(last.subject)} · {last.book || 'لم يُذكر الكتاب'}</span></div><ArrowLeft size={19} /></div> : <div className="quiet-empty">لم تفتح أي محاضرة بعد. اختر مادة لتبدأ.</div>}
  </>;
}
function TeacherHome({ lectures, onCreate, onOpen, onNotifications, onChannels }) { return <>
  <div className="welcome-banner teacher-banner"><div><span className="welcome-kicker">مساحة الأستاذ</span><h3>جهّز محاضرات موادك</h3><p>أضف محاضرة، وارفق التسجيل أو ملف الـPDF من هنا.</p><button onClick={onCreate}>إضافة محاضرة <Plus size={17} /></button></div><div className="arch-motif" aria-hidden="true"><GraduationCap size={48} strokeWidth={1.1} /></div></div>
  <div className="stat-grid"><div className="stat-card"><div className="round-icon mint"><Headphones size={21} /></div><span>المحاضرات المعروضة</span><strong>{lectures.length}</strong></div><button className="stat-card action-stat" onClick={onNotifications}><div className="round-icon gold"><Bell size={21} /></div><span>الإشعارات</span><strong>إدارة الإشعارات <ArrowLeft size={16} /></strong></button></div>
  <button className="channel-home-link" onClick={onChannels}><div className="round-icon gold"><MessagesSquare size={21} /></div><span><strong>قنوات المواد</strong><small>أنشئ قناة للمادة وانشر تعليماتك وصورك</small></span><ArrowLeft size={19} /></button>
  <div className="section-head extra-section"><div><h3>المحاضرات</h3><p>آخر ما يظهر في المعاينة</p></div></div>
  <div className="lecture-stack">{lectures.slice(0, 4).map(l => <LectureRow key={l.id} lecture={l} onOpen={() => onOpen(l)} />)}</div>
  <p className="scope-note">إحصائيات مشاهدة الطلاب تظهر هنا بعد ربط حسابات الطلاب والتسجيلات بالخدمة الفعلية.</p>
</>; }
function LectureRow({ lecture, onOpen, onDelete, onEdit }) {
  const currentSubject = subjectFor(lecture.subject);
  return <div className="lecture-row">
    <div className={`round-icon ${currentSubject.color}`}><Headphones size={20} /></div>
    <button className="lecture-main" onClick={onOpen}>
      <strong>{lecture.title}</strong>
      <span>{currentSubject.name} · {lecture.book || 'لم يُذكر الكتاب'} <i /> {lecture.date}</span>
    </button>
    {lecture.sample && <span className="sample-tag">تجريبي</span>}
    {onEdit && !lecture.sample && <button className="row-action" onClick={() => onEdit(lecture)}>تعديل</button>}
    {onDelete && !lecture.sample && <IconButton icon={Trash2} label={`حذف ${lecture.title}`} onClick={onDelete} className="delete-button" />}
    <button className="row-arrow" onClick={onOpen} aria-label={`فتح ${lecture.title}`}><ChevronLeft size={20} /></button>
  </div>;
}
function LectureList({ lectures, role, query, onQuery, onOpen, onDelete, onEdit, emptyText }) {
  return <section className="section-block list-block">
    <div className="section-head">
      <div><h3>قائمة المحاضرات</h3><p>{lectures.length} محاضرات</p></div>
      <label className="search-box"><Search size={18} /><input value={query} onChange={e => onQuery(e.target.value)} placeholder="ابحث عن محاضرة" aria-label="ابحث عن محاضرة" /></label>
    </div>
    {lectures.length ? <div className="lecture-stack">{lectures.map(l => <LectureRow key={l.id} lecture={l} onOpen={() => onOpen(l)} onDelete={role === 'teacher' && onDelete ? () => onDelete(l.id) : null} onEdit={role === 'teacher' ? onEdit : null} />)}</div>
      : <Empty icon={Headphones} text={emptyText || (query ? 'لم نعثر على محاضرة بهذا الاسم.' : 'لا توجد محاضرات هنا حاليًا.')} />}
  </section>;
}
function LectureDetail({ lecture, note, onNote, favorite, onFavorite, role, flash }) {
  const [audioError, setAudioError] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [saved, setSaved] = useState(false);
  const noteTimer = useRef(null);
  const noteInput = useRef(null);
  useEffect(() => {
    setAudioError(false); setPosition(0); setDuration(0);
    return () => clearTimeout(noteTimer.current);
  }, [lecture.id]);
  const resumeKey = `hawza-playback-${lecture.id}`;
  const insertLine = prefix => {
    const area = noteInput.current;
    if (!area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const before = note.slice(0, start);
    const insertion = `${start && !before.endsWith('\n') ? '\n' : ''}${prefix}${note.slice(start, end)}`;
    onNote(before + insertion + note.slice(end));
    requestAnimationFrame(() => { area.focus(); area.setSelectionRange(start + insertion.length, start + insertion.length); });
  };
  return <div className="detail-layout">
    <div className="detail-main">
      <div className="detail-header">
        <span className="subject-label">{subjectFor(lecture.subject).name}</span>
        <h2>{lecture.title}</h2>
        <p>{lecture.description || 'لا يوجد وصف لهذه المحاضرة.'}</p>
        <div className="detail-meta"><span><Clock3 size={16} />{lecture.date}</span>{lecture.sample && <span className="sample-tag">محتوى توضيحي</span>}</div>
      </div>
      <section className="player-card">
        <div className="section-head"><div><h3>التسجيل الصوتي</h3><p>استمع للمحاضرة وتابع من حيث توقفت</p></div><div className="round-icon mint"><Headphones size={21} /></div></div>
        {lecture.audioUrl && !audioError ? <div className="audio-box">
          <audio controls src={lecture.audioUrl} preload="metadata" onError={() => setAudioError(true)}
            onTimeUpdate={e => { const t = e.currentTarget.currentTime; setPosition(t); writeLocal(resumeKey, String(t)); }}
            onLoadedMetadata={e => { const el = e.currentTarget; setDuration(el.duration); const t = Number(readLocal(resumeKey, 0)) || 0; if (t > 0 && t < el.duration - 2) el.currentTime = t; }}
            onEnded={() => removeLocal(resumeKey)} />
          {duration > 0 && <small>الوقت الحالي: {Math.floor(position / 60)}:{String(Math.floor(position % 60)).padStart(2, '0')} من {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}</small>}
        </div> : <div className="media-empty"><div className="empty-icon"><Headphones size={26} /></div><strong>{audioError ? 'تعذر تشغيل هذا الملف' : 'لم يُرفق تسجيل صوتي بهذه المحاضرة بعد'}</strong><p>{audioError ? 'جرّب ملفًا صوتيًا يدعمه المتصفح.' : 'يظهر مشغل الصوت هنا بعد أن يرفعه الأستاذ.'}</p></div>}
      </section>
      {role === 'student' && <section className="notes-card">
        <div className="section-head"><div><h3>ملاحظاتي</h3><p>اكتب ملاحظاتك الخاصة على هذه المحاضرة</p></div><FileText size={22} className="teal-ink" /></div>
        <div className="note-tools" aria-label="تنسيق الملاحظات"><button type="button" onClick={() => insertLine('عنوان: ')}>عنوان</button><button type="button" onClick={() => insertLine('• ')}>قائمة نقطية</button></div>
        <textarea ref={noteInput} value={note} onChange={e => {
          onNote(e.target.value); setSaved(false); clearTimeout(noteTimer.current);
          noteTimer.current = setTimeout(() => setSaved(true), 600);
        }} placeholder="اكتب أفكارك، النقاط المهمة، أو أسئلة تريد الرجوع لها..." aria-label="ملاحظاتي على المحاضرة" />
        <div className="notes-status">{saved ? <><Check size={15} /> حُفظت في هذا المتصفح</> : 'تُحفظ الملاحظات محليًا في هذا المتصفح'}</div>
      </section>}
    </div>
    <aside className="detail-side"><div className="side-info">
      <span className="side-info-label">عن المحاضرة</span>
      <div><span>المادة</span><strong>{subjectName(lecture.subject)}</strong></div><div><span>الكتاب</span><strong>{lecture.book || 'لم يُذكر'}</strong></div>
      <div><span>التاريخ</span><strong>{lecture.date}</strong></div>
      {lecture.pdfUrl ? <div className="pdf-actions"><a className="outline-button pdf-link" href={lecture.pdfUrl} target="_blank" rel="noreferrer"><FileText size={17} /> فتح PDF</a><a className="outline-button pdf-link" href={lecture.pdfUrl} download={`${lecture.title}.pdf`}>تنزيل PDF</a></div> : <p className="no-attachment">لا يوجد ملف PDF مرفق.</p>}
      {role === 'student' && <button className="favorite-button" onClick={() => { onFavorite(); flash(favorite ? 'أُزيلت من المفضلة' : 'أُضيفت إلى المفضلة'); }}><Bookmark size={18} fill={favorite ? 'currentColor' : 'none'} />{favorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}</button>}
    </div>{role === 'teacher' && <p className="scope-note">إحصائيات الطلاب تتطلب حسابات مرتبطة وخدمة تسجيلات فعلية.</p>}</aside>
  </div>;
}
function CreateLecture({ initial, onClose, onSave }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [subject, setSubject] = useState(initial ? subjectName(initial.subject) : '');
  const [book, setBook] = useState(initial?.book || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [audio, setAudio] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async event => {
    event.preventDefault();
    if (!title.trim()) return setError('اكتب عنوانًا للمحاضرة.');
    if (!subject.trim() || !book.trim()) return setError('اكتب اسم المادة والكتاب.');
    if (audio && !(audio.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|opus)$/i.test(audio.name))) return setError('اختر ملفًا صوتيًا صالحًا.');
    if (pdf && !(pdf.type === 'application/pdf' || /\.pdf$/i.test(pdf.name))) return setError('اختر ملف PDF صالحًا.');
    setError(''); setSaving(true);
    try {
      await onSave({
        id: initial?.id || crypto.randomUUID(), title: title.trim(), subject: subject.trim(), book: book.trim(),
        description: description.trim(), date: initial?.date || new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()),
        audioFile: audio, pdfFile: pdf, sample: false,
      });
    } catch { setError('تعذر حفظ المحاضرة. جرّب مرة ثانية.'); setSaving(false); }
  };
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><div><span className="overline">واجهة الأستاذ</span><h2 id="modal-title">{initial ? 'تعديل المحاضرة' : 'إضافة محاضرة'}</h2></div><IconButton icon={X} label="إغلاق" onClick={onClose} /></div>
      <form onSubmit={submit}>
        <label>عنوان المحاضرة<input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: المحاضرة الأولى" required maxLength={100} autoFocus /></label>
        <label>اسم المادة<input value={subject} onChange={e => setSubject(e.target.value)} placeholder="مثال: الفقه" required maxLength={80} /></label><label>اسم الكتاب المُدرّس<input value={book} onChange={e => setBook(e.target.value)} placeholder="مثال: شرائع الإسلام" required maxLength={100} /></label>
        <label>وصف مختصر<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="نبذة عن موضوع المحاضرة" rows="3" maxLength={500} /></label>
        <div className="upload-grid">
          <label className="file-field"><UploadCloud size={21} /><strong>تسجيل صوتي</strong><span>{audio ? audio.name : initial?.audioUrl ? 'تسجيل موجود · اختر ملفًا لاستبداله' : 'اختياري · اختر ملفًا'}</span><input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" onChange={e => setAudio(e.target.files?.[0] || null)} /></label>
          <label className="file-field"><FileText size={21} /><strong>ملف PDF</strong><span>{pdf ? pdf.name : initial?.pdfUrl ? 'ملف موجود · اختر ملفًا لاستبداله' : 'اختياري · اختر ملفًا'}</span><input type="file" accept="application/pdf,.pdf" onChange={e => setPdf(e.target.files?.[0] || null)} /></label>
        </div>
        <p className="form-note">محاضرات هذه المعاينة وملفاتها تُحفظ في هذا المتصفح إن سمح بالتخزين المحلي. لا تظهر على أجهزة أخرى.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>إلغاء</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'جارٍ الحفظ…' : initial ? 'حفظ التعديل' : 'إضافة المحاضرة'} <Plus size={17} /></button></div>
      </form>
    </div>
  </div>;
}
function CreateNotice({ onClose, onSave }) { const [title, setTitle] = useState(''); const [body, setBody] = useState(''); return <div className="modal-backdrop" onClick={onClose}><div className="modal small-modal" role="dialog" aria-modal="true" aria-labelledby="notice-title" onClick={e => e.stopPropagation()}><div className="modal-head"><h2 id="notice-title">إشعار جديد</h2><IconButton icon={X} label="إغلاق" onClick={onClose} /></div><form onSubmit={e => { e.preventDefault(); if (!title.trim() || !body.trim()) return; onSave({ id: crypto.randomUUID(), title: title.trim(), body: body.trim(), date: 'الآن' }); }}><label>العنوان<input value={title} onChange={e => setTitle(e.target.value)} required maxLength={80} /></label><label>نص الإشعار<textarea value={body} onChange={e => setBody(e.target.value)} rows="4" required maxLength={500} /></label><p className="form-note">يظهر الإشعار داخل المعاينة فقط؛ إشعارات الهاتف تحتاج تفعيلها عند ربط المنصة.</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>إلغاء</button><button type="submit" className="primary-button">نشر في المعاينة</button></div></form></div></div>; }
