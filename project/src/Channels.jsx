import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Hash, ImagePlus, Plus, Search, Trash2, Users, X } from 'lucide-react';
import './channels.css';

const subjectName = id => ({ fiqh: 'الفقه', usul: 'أصول الفقه', aqida: 'العقائد' })[id] || id || 'مادة غير محددة';
const today = () => new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

export default function Channels({ role, userId, channels, joined, allowedSubjects, onCreate, onJoin, onLeave, onPost, onDeletePost, onDeleteChannel }) {
  const [activeId, setActiveId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [lookedUp, setLookedUp] = useState('');
  const active = channels.find(channel => channel.id === activeId);
  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin';
  const found = lookedUp ? channels.find(channel => channel.handle === lookedUp) : null;
  const mine = isAdmin ? channels : isTeacher ? channels.filter(channel => !channel.ownerId || channel.ownerId === userId) : channels.filter(channel => joined.includes(channel.id));

  return <div className="channels-area">
    <div className="channels-intro">
      <div><span className="overline">قنوات المواد</span><h3>{isAdmin ? 'قنوات المواد المنشورة' : isTeacher ? 'انشر توجيهات المادة في قناتها' : 'تابع توجيهات أساتذتك'}</h3><p>{isAdmin ? 'استعرض قنوات الأساتذة ومنشوراتهم وأدر محتوى القنوات عند الحاجة.' : isTeacher ? 'أنشئ قناة بمعرّف خاص، ثم انشر التعليمات والصور لطلاب المادة.' : 'ابحث عن معرّف القناة الذي يعطيك إياه الأستاذ، ثم انضم إليها.'}</p></div>
      {isTeacher && <button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={17} /> إنشاء قناة</button>}
    </div>

    {active ? <>
      <button className="back-button" onClick={() => setActiveId(null)}><ArrowRight size={17} /> جميع القنوات</button>
      <div className="channel-cover"><div className="channel-emblem"><BookOpen size={26} /></div><div><span>{subjectName(active.subject)} · {active.book || 'لم يُذكر الكتاب'}</span><h3>{active.name}</h3><p>{active.description || 'قناة المادة التعليمية'}</p><code dir="ltr">@{active.handle}</code></div></div>
      {!isTeacher && !isAdmin && !joined.includes(active.id) ? <div className="channel-join-required"><p>انضم إلى القناة للاطلاع على منشوراتها.</p><button className="primary-button" onClick={() => onJoin(active.id)}>الانضمام للقناة</button></div> : <>
        <div className="channel-detail-actions">{isTeacher || isAdmin ? <button className="text-button danger-text" onClick={async () => { try { if (await onDeleteChannel(active)) setActiveId(null); } catch { /* The parent displays the error. */ } }}>حذف القناة <Trash2 size={16} /></button> : <button className="text-button" onClick={() => { onLeave(active.id); setActiveId(null); }}>مغادرة القناة</button>}</div>
        {isTeacher && <PostComposer key={active.id} channel={active} onPost={onPost} />}
        <div className="channel-posts-head"><h3>المنشورات</h3><span>{active.posts?.length || 0} منشورات</span></div>
        {(active.posts || []).length ? <div className="channel-feed">{active.posts.map(post => <article className="channel-post" key={post.id}><div className="channel-post-top"><div className="channel-post-avatar"><BookOpen size={17} /></div><div><strong>{active.teacherName || 'أستاذ المادة'}</strong><small>{post.date}</small></div>{(isTeacher || isAdmin) && <button className="channel-delete" aria-label="حذف المنشور" onClick={() => onDeletePost(active.id, post.id)}><Trash2 size={17} /></button>}</div>{post.text && <p>{post.text}</p>}{post.imageUrl && <img src={post.imageUrl} alt={post.text ? `صورة مرفقة بالمنشور: ${post.text.slice(0, 80)}` : 'صورة مرفقة بمنشور الأستاذ'} loading="lazy" />}{post.imageName && !post.imageUrl && <div className="channel-image-missing">هذه الصورة غير متاحة في هذا المتصفح.</div>}</article>)}</div> : <div className="channel-empty"><ImagePlus size={25} /><p>لم يُنشر شيء في هذه القناة بعد.</p></div>}
      </>}
    </> : <>
      {!isTeacher && !isAdmin && <form className="channel-search" onSubmit={event => { event.preventDefault(); setLookedUp(search.trim().replace(/^@/, '').toLowerCase()); }}><label htmlFor="channel-handle-search">البحث بمعرّف القناة</label><div><Hash size={19} /><input id="channel-handle-search" dir="ltr" value={search} onChange={event => { setSearch(event.target.value); setLookedUp(''); }} placeholder="مثال: fiqh_stage1" autoComplete="off" /><button className="primary-button" type="submit"><Search size={17} /> بحث</button></div></form>}
      {!isTeacher && lookedUp && <div className="channel-results"><h3>نتيجة البحث</h3>{found ? <ChannelCard channel={found} joined={joined.includes(found.id)} onOpen={() => setActiveId(found.id)} onJoin={() => onJoin(found.id)} /> : <div className="channel-empty"><Search size={24} /><p>لا توجد قناة بهذا المعرّف. تأكد من كتابته كما أعطاك الأستاذ.</p></div>}</div>}
      <div className="channel-list-head"><h3>{isAdmin ? 'جميع القنوات' : isTeacher ? 'قنوات المواد' : 'قنواتي'}</h3><span>{mine.length} قنوات</span></div>
      {mine.length ? <div className="channel-grid">{mine.map(channel => <ChannelCard key={channel.id} channel={channel} joined={joined.includes(channel.id)} teacher={isTeacher || isAdmin} onOpen={() => setActiveId(channel.id)} />)}</div> : <div className="channel-empty"><Users size={27} /><p>{isAdmin ? 'لا توجد قنوات بعد.' : isTeacher ? 'لم تنشئ قناة بعد. ابدأ بقناة لمادة تدرّسها.' : 'لم تنضم إلى أي قناة بعد. ابحث عن معرّف قناة المادة.'}</p></div>}
    </>}
    {createOpen && <CreateChannel channels={channels} allowedSubjects={allowedSubjects} onClose={() => setCreateOpen(false)} onCreate={async channel => { const id = await onCreate(channel); setCreateOpen(false); setActiveId(id || channel.id); }} />}
  </div>;
}

function ChannelCard({ channel, joined, teacher, onOpen, onJoin }) {
  return <article className="channel-card"><div className="channel-card-icon"><BookOpen size={23} /></div><span className="channel-subject">{subjectName(channel.subject)} · {channel.book || 'لم يُذكر الكتاب'}</span><h4>{channel.name}</h4><p>{channel.description || 'قناة المادة التعليمية'}</p><code dir="ltr">@{channel.handle}</code><div className="channel-card-bottom"><span>{channel.posts?.length || 0} منشورات</span>{onJoin && !joined ? <button onClick={onJoin}>انضمام <Plus size={16} /></button> : <button onClick={onOpen}>{teacher ? 'إدارة القناة' : 'دخول القناة'} <ArrowLeft size={16} /></button>}</div></article>;
}

function CreateChannel({ channels, allowedSubjects, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [subject, setSubject] = useState(allowedSubjects?.[0] || '');
  const [book, setBook] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async event => {
    event.preventDefault();
    const normalized = handle.trim().replace(/^@/, '').toLowerCase();
    if (!name.trim()) return setError('اكتب اسمًا للقناة.');
    if (!subject.trim() || !book.trim()) return setError('اكتب اسم المادة واسم الكتاب.');
    if (!/^[a-z][a-z0-9_]{3,23}$/.test(normalized)) return setError('المعرّف يبدأ بحرف إنجليزي ويتكون من ٤ إلى ٢٤ حرفًا أو رقمًا أو شرطة سفلية.');
    if (channels.some(channel => channel.handle === normalized)) return setError('هذا المعرّف مستخدم لقناة أخرى.');
    setBusy(true); setError('');
    try { await onCreate({ id: crypto.randomUUID(), name: name.trim(), handle: normalized, subject: subject.trim(), book: book.trim(), description: description.trim(), date: today(), posts: [] }); }
    catch (cause) { setError(cause.message || 'تعذر إنشاء القناة. حاول مرة ثانية.'); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onClick={onClose}><div className="modal channel-modal" role="dialog" aria-modal="true" aria-labelledby="create-channel-title" onClick={event => event.stopPropagation()}><div className="modal-head"><div><span className="overline">قنوات المواد</span><h2 id="create-channel-title">إنشاء قناة</h2></div><button type="button" className="icon-button" aria-label="إغلاق" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><label>اسم القناة<input value={name} onChange={event => setName(event.target.value)} maxLength="70" placeholder="مثال: دروس الفقه للمرحلة الأولى" required /></label><label>اسم المادة{allowedSubjects ? <select value={subject} onChange={event => setSubject(event.target.value)} required>{allowedSubjects.map(item => <option key={item}>{item}</option>)}</select> : <input value={subject} onChange={event => setSubject(event.target.value)} maxLength="80" placeholder="مثال: الفقه" required />}</label><label>اسم الكتاب المُدرّس<input value={book} onChange={event => setBook(event.target.value)} maxLength="100" placeholder="مثال: شرائع الإسلام" required /></label><label>معرّف القناة <small>يستخدمه الطالب للبحث والانضمام</small><input dir="ltr" value={handle} onChange={event => setHandle(event.target.value)} maxLength="25" placeholder="fiqh_stage1" autoComplete="off" required /></label><label>وصف مختصر <small>اختياري</small><textarea value={description} onChange={event => setDescription(event.target.value)} maxLength="180" rows="3" placeholder="ما الذي تنشره هذه القناة؟" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>إلغاء</button><button className="primary-button" disabled={busy} type="submit">{busy ? 'جارٍ الإنشاء…' : 'إنشاء القناة'}</button></div></form></div></div>;
}

function PostComposer({ channel, onPost }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async event => {
    event.preventDefault();
    if (!text.trim() && !image) return setError('اكتب تعليمات أو أرفق صورة.');
    if (image && !['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) return setError('الصورة يجب أن تكون JPG أو PNG أو WebP.');
    if (image && image.size > 5 * 1024 * 1024) return setError('حجم الصورة يجب ألا يتجاوز ٥ ميغابايت في هذه المعاينة.');
    setError(''); setBusy(true);
    const form = event.currentTarget;
    try { await onPost(channel.id, { id: crypto.randomUUID(), text: text.trim(), date: today(), image }); setText(''); setImage(null); form.reset(); }
    catch { setError('تعذر حفظ المنشور. حاول مرة أخرى.'); }
    finally { setBusy(false); }
  };
  return <form className="channel-composer" onSubmit={submit}><label htmlFor="channel-post-text">منشور جديد</label><textarea id="channel-post-text" value={text} onChange={event => setText(event.target.value)} rows="3" maxLength="3000" placeholder="اكتب تعليمات الدرس أو إعلانًا للطلاب..." /><div className="channel-composer-bottom"><label className="channel-file-button"><ImagePlus size={18} />{image ? image.name : 'إرفاق صورة'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setImage(event.target.files?.[0] || null)} /></label><button className="primary-button" disabled={busy} type="submit">{busy ? 'جارٍ النشر…' : 'نشر في القناة'}</button></div>{error && <p className="form-error" role="alert">{error}</p>}</form>;
}
