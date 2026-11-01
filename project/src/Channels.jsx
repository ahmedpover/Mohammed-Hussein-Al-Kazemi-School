import { useMotionState } from './motion.js';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, FileText, Hash, Headphones, ImagePlus, ListChecks, MessageSquare, Plus, Search, Send, Trash2, Users, X } from 'lucide-react';
import './channels.css';

const subjectName = id => ({ fiqh: 'الفقه', usul: 'أصول الفقه', aqida: 'العقائد' })[id] || id || 'مادة غير محددة';
const today = () => new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

export default function Channels({ role, userId, channelTeachers = [], channels, lectures = [], joined, allowedSubjects, onCreate, onJoin, onLeave, onPost, onPoll, onVote, onClosePoll, onDeletePost, onDeleteChannel, onOpenLecture }) {
  const [activeId, setActiveId] = useMotionState(null);
  const [createOpen, setCreateOpen] = useMotionState(false);
  const [search, setSearch] = useState('');
  const [lookedUp, setLookedUp] = useState('');
  const [showLectures, setShowLectures] = useState(false);
  const feedRef = useRef(null);
  const nearBottom = useRef(true);
  const active = channels.find(channel => channel.id === activeId);
  const activeLectures = lectures.filter(lecture => lecture.channelId === activeId);
  const activePosts = active?.posts || [];
  const newestFirst = [...activePosts].reverse();
  useEffect(() => { setShowLectures(false); nearBottom.current = true; }, [activeId]);
  useEffect(() => {
    const feed = feedRef.current;
    if (feed && nearBottom.current) feed.scrollTop = feed.scrollHeight;
  }, [activeId, activePosts.length]);
  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin';
  const found = lookedUp ? channels.find(channel => channel.handle === lookedUp) : null;
  const mine = isAdmin ? channels : isTeacher ? channels.filter(channel => !channel.ownerId || channel.ownerId === userId) : channels.filter(channel => joined.includes(channel.id));

  return <div className="channels-area">
    <div className="channels-intro">
      <div><span className="overline">قنوات المواد</span><h3>{isAdmin ? 'قنوات المواد المنشورة' : isTeacher ? 'انشر توجيهات المادة في قناتها' : 'تابع توجيهات أساتذتك'}</h3><p>{isAdmin ? 'استعرض قنوات الأساتذة ومنشوراتهم وأدر محتوى القنوات عند الحاجة.' : isTeacher ? 'أنشئ قناة بمعرّف خاص، ثم انشر التعليمات والصور لطلاب المادة.' : 'ابحث عن معرّف القناة الذي يعطيك إياه الأستاذ، ثم انضم إليها.'}</p></div>
      {(isTeacher || isAdmin) && <button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={17} /> إنشاء قناة</button>}
    </div>

    {active ? <>
      <button className="back-button" onClick={() => setActiveId(null)}><ArrowRight size={17} /> جميع القنوات</button>
      <div className="channel-cover channel-chat-cover"><div className="channel-emblem"><BookOpen size={23} /></div><div><span>{subjectName(active.subject)} · {active.book || 'لم يُذكر الكتاب'}</span><h3>{active.name}</h3><p>{active.description || 'قناة المادة التعليمية'}</p></div><code dir="ltr">@{active.handle}</code></div>
      {!isTeacher && !isAdmin && !joined.includes(active.id) ? <div className="channel-join-required"><p>انضم إلى القناة للاطلاع على رسائلها واستفتاءاتها.</p><button className="primary-button" onClick={() => onJoin(active.id)}>الانضمام للقناة</button></div> : <>
        <div className="channel-detail-actions">{(isAdmin || (isTeacher && active.ownerId === userId)) ? <button className="text-button danger-text" onClick={async () => { try { if (await onDeleteChannel(active)) setActiveId(null); } catch { /* The parent displays the error. */ } }}>حذف القناة <Trash2 size={16} /></button> : <button className="text-button" onClick={() => { onLeave(active.id); setActiveId(null); }}>مغادرة القناة</button>}</div>
        <section className="channel-lectures-section channel-lectures-compact">
          <button type="button" className="channel-lectures-toggle" aria-expanded={showLectures} onClick={() => setShowLectures(value => !value)}>
            <span><Headphones size={19} /> محاضرات القناة <small>{activeLectures.length} محاضرات</small></span><ChevronDown size={19} className={showLectures ? 'channel-chevron-open' : ''} />
          </button>
          {showLectures && (activeLectures.length ? <div className="lecture-stack">{activeLectures.map(lecture => <article className="lecture-row" key={lecture.id}><div className="round-icon mint"><Headphones size={20} /></div><button className="lecture-main" onClick={() => onOpenLecture?.(lecture.id)}><strong>{lecture.title}</strong><span>{lecture.book} · {lecture.date}</span></button><span className="channel-lecture-files">{lecture.audioUrl ? <Headphones size={16} aria-label="يتضمن تسجيلاً صوتيًا" /> : null}{lecture.pdfUrl ? <FileText size={16} aria-label="يتضمن ملف PDF" /> : null}</span></article>)}</div> : <div className="channel-empty"><Headphones size={22}/><p>لا توجد محاضرات في هذه القناة بعد.</p></div>)}
        </section>
        <section className="channel-chat" aria-label={`رسائل قناة ${active.name}`}>
          <div className="channel-chat-heading"><span><MessageSquare size={18} /> رسائل القناة</span><small>{activePosts.length} رسالة واستفتاء</small></div>
          <div className="channel-chat-feed" ref={feedRef} onScroll={event => { const el=event.currentTarget; nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<90; }}>
            {newestFirst.length ? newestFirst.map((post,index) => <React.Fragment key={post.id}>
              {(index===0 || newestFirst[index-1].date!==post.date) && <div className="channel-date-divider"><span>{post.date}</span></div>}
              <ChannelMessage post={post} teacherName={post.authorName || active.teacherName} role={role} canManage={isAdmin || (isTeacher && active.ownerId === userId)} onDelete={() => onDeletePost(active.id,post.id)} onVote={optionIndex => onVote(active.id,post.id,optionIndex)} onClose={() => onClosePoll(active.id,post.id)} />
            </React.Fragment>) : <div className="channel-chat-empty"><MessageSquare size={26} /><strong>القناة هادئة حالياً</strong><p>أول رسالة أو استفتاء راح يظهر هنا.</p></div>}
          </div>
          {(isAdmin || (isTeacher && active.ownerId === userId)) ? <PostComposer key={active.id} channel={active} onPost={onPost} onPoll={onPoll} /> : <p className="channel-chat-readonly">تظهر هنا رسائل أستاذك واستفتاءاته. تگدر تصوّت على الاستفتاءات من داخل القناة.</p>}
        </section>
      </>}
    </> : <>
      {!isTeacher && !isAdmin && <form className="channel-search" onSubmit={event => { event.preventDefault(); setLookedUp(search.trim().replace(/^@/, '').toLowerCase()); }}><label htmlFor="channel-handle-search">البحث بمعرّف القناة</label><div><Hash size={19} /><input id="channel-handle-search" dir="ltr" value={search} onChange={event => { setSearch(event.target.value); setLookedUp(''); }} placeholder="مثال: fiqh_stage1" autoComplete="off" /><button className="primary-button" type="submit"><Search size={17} /> بحث</button></div></form>}
      {!isTeacher && lookedUp && <div className="channel-results"><h3>نتيجة البحث</h3>{found ? <ChannelCard channel={found} joined={joined.includes(found.id)} onOpen={() => setActiveId(found.id)} onJoin={() => onJoin(found.id)} /> : <div className="channel-empty"><Search size={24} /><p>لا توجد قناة بهذا المعرّف. تأكد من كتابته كما أعطاك الأستاذ.</p></div>}</div>}
      <div className="channel-list-head"><h3>{isAdmin ? 'جميع القنوات' : isTeacher ? 'قنوات المواد' : 'قنواتي'}</h3><span>{mine.length} قنوات</span></div>
      {mine.length ? <div className="channel-grid">{mine.map(channel => <ChannelCard key={channel.id} channel={channel} joined={joined.includes(channel.id)} teacher={isTeacher || isAdmin} onOpen={() => setActiveId(channel.id)} />)}</div> : <div className="channel-empty"><Users size={27} /><p>{isAdmin ? 'لا توجد قنوات بعد.' : isTeacher ? 'لم تنشئ قناة بعد. ابدأ بقناة لمادة تدرّسها.' : 'لم تنضم إلى أي قناة بعد. ابحث عن معرّف قناة المادة.'}</p></div>}
    </>}
    {createOpen && <CreateChannel channels={channels} isAdmin={isAdmin} teachers={channelTeachers} allowedSubjects={allowedSubjects} onClose={() => setCreateOpen(false)} onCreate={async channel => { const id = await onCreate(channel); setCreateOpen(false); setActiveId(id || channel.id); }} />}
  </div>;
}

function ChannelCard({ channel, joined, teacher, onOpen, onJoin }) {
  return <article className="channel-card"><div className="channel-card-icon"><BookOpen size={23} /></div><span className="channel-subject">{subjectName(channel.subject)} · {channel.book || 'لم يُذكر الكتاب'}</span><h4>{channel.name}</h4><p>{channel.description || 'قناة المادة التعليمية'}</p><code dir="ltr">@{channel.handle}</code><div className="channel-card-bottom"><span>{channel.posts?.length || 0} منشورات</span>{onJoin && !joined ? <button onClick={onJoin}>انضمام <Plus size={16} /></button> : <button onClick={onOpen}>{teacher ? 'إدارة القناة' : 'دخول القناة'} <ArrowLeft size={16} /></button>}</div></article>;
}

function CreateChannel({ channels, allowedSubjects, isAdmin, teachers = [], onClose, onCreate }) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const selectedTeacher = teachers.find(item => item.id === teacherId);
  const choices = isAdmin ? (selectedTeacher?.subjects || []) : allowedSubjects;
  const [subject, setSubject] = useState(allowedSubjects?.[0] || '');
  const [book, setBook] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async event => {
    event.preventDefault();
    const normalized = handle.trim().replace(/^@/, '').toLowerCase();
    if (!name.trim()) return setError('اكتب اسمًا للقناة.');
    if (isAdmin && !selectedTeacher) return setError('اختر أستاذًا مسجّلاً لتعيين القناة له.');
    if (isAdmin && !selectedTeacher.subjects.includes(subject)) return setError('اختر مادة معتمدة لهذا الأستاذ.');
    if (!subject.trim() || !book.trim()) return setError('اكتب اسم المادة واسم الكتاب.');
    if (!/^[a-z][a-z0-9_]{3,23}$/.test(normalized)) return setError('المعرّف يبدأ بحرف إنجليزي ويتكون من ٤ إلى ٢٤ حرفًا أو رقمًا أو شرطة سفلية.');
    if (channels.some(channel => channel.handle === normalized)) return setError('هذا المعرّف مستخدم لقناة أخرى.');
    setBusy(true); setError('');
    try { await onCreate({ id: crypto.randomUUID(), teacherId: isAdmin ? teacherId : undefined, name: name.trim(), handle: normalized, subject: subject.trim(), book: book.trim(), description: description.trim(), date: today(), posts: [] }); }
    catch (cause) { setError(cause.message || 'تعذر إنشاء القناة. حاول مرة ثانية.'); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onClick={onClose}><div className="modal channel-modal" role="dialog" aria-modal="true" aria-labelledby="create-channel-title" onClick={event => event.stopPropagation()}><div className="modal-head"><div><span className="overline">قنوات المواد</span><h2 id="create-channel-title">إنشاء قناة</h2></div><button type="button" className="icon-button" aria-label="إغلاق" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}>{isAdmin && <><label>الأستاذ المسؤول عن القناة<select value={teacherId} onChange={event => { const teacher = teachers.find(item => item.id === event.target.value);setTeacherId(event.target.value);setSubject(teacher?.subjects?.[0] || ''); }} required><option value="">اختر الأستاذ…</option>{teachers.map(item => <option key={item.id} value={item.id}>{item.name} — {item.email}</option>)}</select></label><p className="scope-note">القناة ستصبح ملكًا للأستاذ المختار، ويستطيع إدارة منشوراتها ومحاضراتها بحسابه.</p>{!teachers.length && <p className="form-error">ماكو أساتذة مسجّلين ومفعّلين حالياً. لازم الأستاذ يسجّل حسابه أولاً.</p>}</>}<label>اسم القناة<input value={name} onChange={event => setName(event.target.value)} maxLength="70" placeholder="مثال: دروس الفقه للمرحلة الأولى" required /></label><label>اسم المادة{choices ? <select value={subject} onChange={event => setSubject(event.target.value)} required><option value="">اختر المادة…</option>{choices.map(item => <option key={item} value={item}>{item}</option>)}</select> : <input value={subject} onChange={event => setSubject(event.target.value)} maxLength="80" placeholder="مثال: الفقه" required />}</label><label>اسم الكتاب المُدرّس<input value={book} onChange={event => setBook(event.target.value)} maxLength="100" placeholder="مثال: شرائع الإسلام" required /></label><label>معرّف القناة <small>يستخدمه الطالب للبحث والانضمام</small><input dir="ltr" value={handle} onChange={event => setHandle(event.target.value)} maxLength="25" placeholder="fiqh_stage1" autoComplete="off" required /></label><label>وصف مختصر <small>اختياري</small><textarea value={description} onChange={event => setDescription(event.target.value)} maxLength="180" rows="3" placeholder="ما الذي تنشره هذه القناة؟" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>إلغاء</button><button className="primary-button" disabled={busy || (isAdmin && !teachers.length)} type="submit">{busy ? 'جارٍ الإنشاء…' : 'إنشاء القناة'}</button></div></form></div></div>;
}

function timeOf(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-IQ', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function ChannelMessage({ post, teacherName, role, canManage, onDelete, onVote, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const options = Array.isArray(post.pollOptions) ? post.pollOptions : [];
  const counts = options.map((_, i) => Number(post.pollCounts?.[i] || 0));
  const totalVotes = counts.reduce((sum, current) => sum + current, 0);
  const voted = post.myVote !== null && post.myVote !== undefined;
  const showResults = role !== 'student' || voted || post.pollClosed;
  const choose = async optionIndex => {
    if (busy || post.pollClosed || role !== 'student') return;
    setBusy(true); setError('');
    try { await onVote(optionIndex); } catch (err) { setError(err.message || 'تعذر تسجيل التصويت.'); }
    finally { setBusy(false); }
  };
  const close = async () => {
    if (busy || !window.confirm('إغلاق التصويت؟ ستبقى النتائج ظاهرة ولا يمكن إعادة فتحه.')) return;
    setBusy(true);setError('');
    try { await onClose(); } catch(err) { setError(err.message || 'تعذر إغلاق الاستفتاء.'); }
    finally { setBusy(false); }
  };
  return <article className={`channel-message ${options.length ? 'channel-message-poll' : ''}`}>
    <div className="channel-message-head"><strong>{teacherName || 'أستاذ المادة'}</strong><span>{timeOf(post.createdAt)}</span></div>
    {post.text && <p className="channel-message-text">{post.text}</p>}
    {post.imageUrl && <img className="channel-message-photo" src={post.imageUrl} alt={post.text ? `صورة مرفقة: ${post.text.slice(0,80)}` : 'صورة في القناة'} loading="lazy" />}
    {post.imageName && !post.imageUrl && <div className="channel-image-missing">الصورة غير متاحة.</div>}
    {options.length > 0 && <div className="channel-poll">
      <div className="channel-poll-title"><ListChecks size={19}/><strong>{post.pollQuestion}</strong></div>
      <small className="channel-poll-hint">{post.pollClosed ? 'انتهى التصويت' : 'استفتاء · اختيار واحد'} </small>
      <div className="channel-poll-options">
        {options.map((option,i) => {
          const percentage = totalVotes ? Math.round(counts[i]*100/totalVotes) : 0;
          const chosen = voted && Number(post.myVote)===i;
          return <button type="button" key={i} disabled={busy || post.pollClosed || role !== 'student'} onClick={() => choose(i)} className={`channel-poll-option ${chosen ? 'is-chosen' : ''} ${showResults ? 'has-results' : ''}`} aria-label={`${option}${showResults ? `، ${percentage} بالمئة` : ''}`}>
            {showResults && <span className="channel-poll-bar" style={{width:`${percentage}%`}} />}
            <span className="channel-poll-answer">{chosen ? <Check size={16} /> : <span className="channel-poll-radio" aria-hidden="true"/>}{option}</span>
            {showResults && <span className="channel-poll-percent">{percentage}%</span>}
          </button>;
        })}
      </div>
      <div className="channel-poll-footer"><span>{totalVotes} {totalVotes===1 ? 'تصويت' : 'تصويتات'}</span>{role==='student' && voted && !post.pollClosed && <span>يمكنك تغيير اختيارك</span>}{canManage && !post.pollClosed && <button type="button" className="channel-close-poll" disabled={busy} onClick={close}>إنهاء الاستفتاء</button>}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>}
    {canManage && <button type="button" className="channel-message-delete" aria-label="حذف الرسالة" title="حذف الرسالة" onClick={onDelete}><Trash2 size={14}/></button>}
  </article>;
}

function PostComposer({ channel, onPost, onPoll }) {
  const [mode, setMode] = useState('message');
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['','']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const submit = async event => {
    event.preventDefault();
    setError('');
    if (mode==='message') {
      if (!text.trim() && !image) return setError('اكتب رسالة أو أرفق صورة.');
      if (image && !['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) return setError('الصورة يجب أن تكون JPG أو PNG أو WebP.');
      if (image && image.size > 5 * 1024 * 1024) return setError('حجم الصورة يجب ألا يتجاوز ٥ ميغابايت.');
    } else {
      if (!question.trim() || question.trim().length>240) return setError('اكتب سؤال الاستفتاء (حتى ٢٤٠ حرفًا).');
      if(options.length < 2 || options.some(value=>!value.trim())) return setError('أدخل خيارين على الأقل، ولا تترك خياراً فارغاً.');
      if(new Set(options.map(value=>value.trim().toLowerCase())).size!==options.length) return setError('لا تكرر نفس الخيار.');
    }
    setBusy(true);
    try {
      if(mode==='message') { await onPost(channel.id, {text:text.trim(), image});setText('');setImage(null);if(fileInput.current)fileInput.current.value=''; }
      else { await onPoll(channel.id,{question:question.trim(),options:options.map(option=>option.trim())});setQuestion('');setOptions(['','']);setMode('message'); }
    } catch (err) { setError(err.message || 'تعذّر النشر. حاول مرة أخرى.'); }
    finally { setBusy(false); }
  };
  return <form className="channel-quick-composer" onSubmit={submit}>
    <div className="channel-compose-tabs"><button type="button" className={mode==='message' ? 'active' : ''} onClick={()=>{setMode('message');setError('');}}><MessageSquare size={17}/> رسالة</button><button type="button" className={mode==='poll' ? 'active' : ''} onClick={()=>{setMode('poll');setError('');}}><ListChecks size={17}/> استفتاء</button></div>
    {mode==='message' ? <div className="channel-compose-message"><textarea aria-label="نص الرسالة" value={text} onChange={event => setText(event.target.value)} rows="2" maxLength="3000" placeholder="اكتب رسالة قصيرة لطلاب القناة..." onKeyDown={event => { if(event.key==='Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault();event.currentTarget.form?.requestSubmit();} }} /><div className="channel-compose-controls"><label className="channel-compose-photo"><ImagePlus size={18}/>{image ? image.name : 'صورة'}<input type="file" ref={fileInput} accept="image/jpeg,image/png,image/webp" onChange={event => setImage(event.target.files?.[0] || null)} /></label>{image && <button type="button" className="channel-compose-clear" onClick={()=>{setImage(null);if(fileInput.current)fileInput.current.value='';}} aria-label="إزالة الصورة"><X size={15}/></button>}<button className="channel-send-button" type="submit" disabled={busy || (!text.trim()&&!image)}><Send size={17}/>{busy ? 'جارٍ الإرسال...' : 'إرسال'}</button></div></div> : <div className="channel-compose-poll">
      <label htmlFor="poll-question">سؤال الاستفتاء</label><input id="poll-question" value={question} onChange={event=>setQuestion(event.target.value)} maxLength="240" placeholder="مثلاً: أي وقت أنسب للدرس القادم؟" />
      <span className="channel-compose-caption">خيارات الإجابة (من ٢ إلى ١٠)</span>
      {options.map((option,index)=><div className="channel-option-editor" key={index}><span>{index+1}</span><input value={option} onChange={event=>setOptions(prev=>prev.map((v,i)=>i===index?event.target.value:v))} maxLength="120" aria-label={`الخيار ${index+1}`} placeholder={`الخيار ${index+1}`} />{options.length>2 && <button type="button" onClick={()=>setOptions(prev=>prev.filter((_,i)=>i!==index))} aria-label={`إزالة الخيار ${index+1}`}><X size={16}/></button>}</div>)}
      <div className="channel-poll-edit-actions">{options.length<10 && <button type="button" className="channel-add-option" onClick={()=>setOptions(prev=>[...prev,''])}><Plus size={17}/> إضافة خيار</button>}<button type="submit" className="channel-send-button" disabled={busy}><ListChecks size={17}/>{busy?'جارٍ النشر...':'نشر الاستفتاء'}</button></div>
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>;
}
