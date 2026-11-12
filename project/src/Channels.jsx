import { useMotionState } from './motion.js';
import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, CheckCircle2, FileText, Hash, Headphones, ImagePlus, MessageSquare, Plus, Search, Send, Trash2, Users, X } from 'lucide-react';
import './channels.css';

const subjectName = id => ({ fiqh: 'الفقه', usul: 'أصول الفقه', aqida: 'العقائد' })[id] || id || 'مادة غير محددة';
const today = () => new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
const messageTime = post => {
  const stamp = post?.createdAt;
  if (!stamp) return post?.date || '';
  const parsed = new Date(stamp);
  return Number.isNaN(parsed.getTime()) ? (post?.date || '') : new Intl.DateTimeFormat('ar-IQ', { hour: 'numeric', minute: '2-digit', hour12: true }).format(parsed);
};

export default function Channels({ role, userId, channelTeachers = [], channels, lectures = [], joined, allowedSubjects, onCreate, onJoin, onLeave, onPost, onPoll, onVote, onDeletePost, onDeleteChannel, onOpenLecture }) {
  const [activeId, setActiveId] = useMotionState(null);
  const [createOpen, setCreateOpen] = useMotionState(false);
  const [search, setSearch] = useState('');
  const [lookedUp, setLookedUp] = useState('');
  const active = channels.find(channel => channel.id === activeId);
  const activeLectures = lectures.filter(lecture => lecture.channelId === activeId);
  const isTeacher = role === 'teacher';
  const isRep = role === 'representative';
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
      <div className="channel-cover"><div className="channel-emblem"><BookOpen size={26} /></div><div><span>{subjectName(active.subject)} · {active.book || 'لم يُذكر الكتاب'}</span><h3>{active.name}</h3><p>{active.description || 'قناة المادة التعليمية'}</p><code dir="ltr">@{active.handle}</code></div></div>
      {!isTeacher && !isAdmin && !joined.includes(active.id) ? <div className="channel-join-required"><p>انضم إلى القناة للاطلاع على منشوراتها.</p><button className="primary-button" onClick={() => onJoin(active.id)}>الانضمام للقناة</button></div> : <>
        <div className="channel-detail-actions">{(isAdmin || (isTeacher && active.ownerId === userId)) ? <button className="text-button danger-text" onClick={async () => { try { if (await onDeleteChannel(active)) setActiveId(null); } catch { /* The parent displays the error. */ } }}>حذف القناة <Trash2 size={16} /></button> : <button className="text-button" onClick={() => { onLeave(active.id); setActiveId(null); }}>مغادرة القناة</button>}</div>
        <section className="channel-lectures-section">
          <div className="channel-posts-head"><h3><Headphones size={19} /> محاضرات القناة</h3><span>{activeLectures.length} محاضرات</span></div>
          {activeLectures.length ? <div className="lecture-stack">{activeLectures.map(lecture => <article className="lecture-row" key={lecture.id}><div className="round-icon mint"><Headphones size={20} /></div><button className="lecture-main" onClick={() => onOpenLecture?.(lecture.id)}><strong>{lecture.title}</strong><span>{lecture.book} · {lecture.date}</span></button><span className="channel-lecture-files">{lecture.audioUrl ? <Headphones size={16} aria-label="يتضمن تسجيلاً صوتيًا" /> : null}{lecture.pdfUrl ? <FileText size={16} aria-label="يتضمن ملف PDF" /> : null}</span></article>)}</div> : <div className="channel-empty"><Headphones size={23} /><p>لا توجد محاضرات منشورة في هذه القناة بعد.</p></div>}
        </section>
        <section className="channel-conversation" aria-label="رسائل القناة">
          <div className="channel-posts-head"><h3><MessageSquare size={20}/> رسائل القناة</h3><span>{active.posts?.length || 0} رسالة واستفتاء</span></div>
          {(active.posts || []).length ? <div className="channel-feed">{active.posts.map(post => <ChatPost key={post.id} post={post} teacherName={post.authorName || active.teacherName || 'أستاذ المادة'} canDelete={isAdmin || (isTeacher && active.ownerId === userId) || (isRep && joined.includes(active.id))} onDelete={() => onDeletePost(active.id, post.id)} onVote={choice => onVote?.(post.id,choice)} />)}</div> : <div className="channel-empty"><MessageSquare size={25} /><p>لا توجد رسائل أو استفتاءات بعد.</p></div>}
        </section>
        {(isAdmin || (isTeacher && active.ownerId === userId) || (isRep && joined.includes(active.id))) && <PostComposer key={active.id} channel={active} onPost={onPost} onPoll={onPoll} />}
      </>}
    </> : <>
      {!isTeacher && !isAdmin && <form className="channel-search" onSubmit={event => { event.preventDefault(); setLookedUp(search.trim().replace(/^@/, '').toLowerCase()); }}><label htmlFor="channel-handle-search">البحث بمعرّف القناة</label><div><Hash size={19} /><input id="channel-handle-search" dir="ltr" value={search} onChange={event => { setSearch(event.target.value); setLookedUp(''); }} placeholder="مثال: fiqh_stage1" autoComplete="off" /><button className="primary-button" type="submit"><Search size={17} /> بحث</button></div></form>}
      {!isTeacher && lookedUp && <div className="channel-results"><h3>نتيجة البحث</h3>{found ? <ChannelCard channel={found} joined={joined.includes(found.id)} onOpen={() => setActiveId(found.id)} onJoin={() => onJoin(found.id)} /> : <div className="channel-empty"><Search size={24} /><p>لا توجد قناة بهذا المعرّف. تأكد من كتابته كما أعطاك الأستاذ.</p></div>}</div>}
      <div className="channel-list-head"><h3>{isAdmin ? 'جميع القنوات' : isTeacher ? 'قنوات المواد' : 'قنواتي'}</h3><span>{mine.length} قنوات</span></div>
      {mine.length ? <div className="channel-grid">{mine.map(channel => <ChannelCard key={channel.id} channel={channel} joined={joined.includes(channel.id)} teacher={isTeacher || isAdmin || isRep} onOpen={() => setActiveId(channel.id)} />)}</div> : <div className="channel-empty"><Users size={27} /><p>{isAdmin ? 'لا توجد قنوات بعد.' : isTeacher ? 'لم تنشئ قناة بعد. ابدأ بقناة لمادة تدرّسها.' : 'لم تنضم إلى أي قناة بعد. ابحث عن معرّف قناة المادة.'}</p></div>}
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

function ChatPost({post,teacherName,canDelete,onDelete,onVote}) {
  return <article className={`channel-message ${post.poll ? 'channel-message-poll' : 'channel-message-text'}`} dir="rtl">
    <div className="channel-message-main">
      <div className="channel-message-meta"><strong>{teacherName}</strong>{canDelete && <button type="button" className="channel-delete" aria-label="حذف الرسالة" title="حذف" onClick={onDelete}><Trash2 size={16}/></button>}</div>
      {post.text && <p>{post.text}</p>}
      {post.imageUrl && <img src={post.imageUrl} alt={post.text ? `صورة مع الرسالة: ${post.text.slice(0,70)}` : 'صورة منشورة في القناة'} loading="lazy" />}
      {post.imageName && !post.imageUrl && <div className="channel-image-missing">الصورة غير متاحة حالياً.</div>}
      {post.poll && <PollCard poll={post.poll} onVote={onVote} />}
      <div className="channel-message-footer"><time dateTime={post.createdAt || undefined} title={post.date || undefined}>{messageTime(post)}</time></div>
    </div>
  </article>;
}

function PollCard({poll,onVote}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const myVote=Number.isInteger(poll.myVote)?poll.myVote:null;
  async function vote(index){
    if(busy || index===myVote)return;
    setBusy(true);setError('');
    try{await onVote(index);}catch(cause){setError(cause.message||'تعذر تسجيل التصويت.');}finally{setBusy(false);}
  }
  return <div className="channel-poll">
    <div className="channel-poll-title"><BarChart3 size={18}/><strong>{poll.question}</strong></div>
    <div className="channel-poll-options">{poll.options.map((option,index)=>{
      const count=poll.counts?.[index]||0;
      const percent=poll.total?Math.round(count*100/poll.total):0;
      const chosen=myVote===index;
      return <button type="button" key={index} className={`channel-poll-choice ${chosen?'chosen':''}`} disabled={busy} aria-pressed={chosen} onClick={()=>vote(index)}>
        <span className="channel-poll-meter" style={{width:`${percent}%`}} aria-hidden="true"/>
        <span className="channel-poll-option-name">{chosen?<CheckCircle2 size={17}/>:<span className="channel-choice-circle"/>}{option}</span>
        <span className="channel-poll-percent">{percent}%</span>
      </button>;
    })}</div>
    <div className="channel-poll-footer">{poll.total||0} تصويت · اختر خياراً للتصويت أو لتغييره</div>
    {error&&<p className="form-error" role="alert">{error}</p>}
  </div>;
}

function PostComposer({ channel, onPost, onPoll }) {
  const [mode,setMode]=useState('message');
  const [text,setText]=useState('');
  const [image,setImage]=useState(null);
  const [question,setQuestion]=useState('');
  const [options,setOptions]=useState(['','']);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const submit = async event => {
    event.preventDefault();
    setError('');setBusy(true);
    try {
      if(mode==='poll') {
        if(!question.trim())throw new Error('اكتب سؤال الاستفتاء.');
        const values=options.map(x=>x.trim()).filter(Boolean);
        if(values.length<2)throw new Error('أضف خيارين على الأقل.');
        if(new Set(values.map(x=>x.toLocaleLowerCase())).size!==values.length)throw new Error('لا تكرر خيارات الاستفتاء.');
        await onPoll(channel.id,{question:question.trim(),options:values});
        setQuestion('');setOptions(['','']);setMode('message');
      } else {
        if (!text.trim() && !image) throw new Error('اكتب رسالة أو أرفق صورة.');
        if (image && !['image/jpeg','image/png','image/webp'].includes(image.type)) throw new Error('الصورة يجب أن تكون JPG أو PNG أو WebP.');
        if (image && image.size > 5*1024*1024) throw new Error('حجم الصورة يجب ألا يتجاوز 5 ميغابايت.');
        await onPost(channel.id,{text:text.trim(),image});
        setText('');setImage(null);event.target.reset();
      }
    }catch(cause){setError(cause.message||'تعذر النشر.');}finally{setBusy(false);}
  };
  return <form className="channel-composer channel-chat-composer" onSubmit={submit}>
    <div className="channel-compose-tabs" role="group" aria-label="نوع المنشور">
      <button type="button" className={mode==='message'?'selected':''} onClick={()=>{setMode('message');setError('');}}><MessageSquare size={17}/> رسالة</button>
      <button type="button" className={mode==='poll'?'selected':''} onClick={()=>{setMode('poll');setError('');}}><BarChart3 size={17}/> استفتاء</button>
    </div>
    {mode==='message'?<>
      <label htmlFor="channel-post-text">رسالة جديدة للطلاب</label>
      <textarea id="channel-post-text" value={text} onChange={event=>setText(event.target.value)} rows="3" maxLength="3000" placeholder="اكتب رسالة أو توجيهاً للطلاب..." />
      <div className="channel-composer-bottom"><label className="channel-file-button"><ImagePlus size={18}/>{image?image.name:'إرفاق صورة'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>setImage(event.target.files?.[0]||null)}/></label><button className="primary-button" disabled={busy} type="submit"><Send size={17}/>{busy?'جارٍ النشر…':'إرسال الرسالة'}</button></div>
    </>:<>
      <label htmlFor="channel-poll-question">سؤال الاستفتاء</label>
      <input id="channel-poll-question" value={question} onChange={event=>setQuestion(event.target.value)} maxLength="250" placeholder="مثلاً: أي وقت أنسب للدرس القادم؟" required />
      <div className="channel-poll-editor">{options.map((option,index)=><div className="channel-poll-edit-row" key={index}><span>{index+1}</span><input value={option} onChange={event=>setOptions(current=>current.map((value,i)=>i===index?event.target.value:value))} maxLength="120" placeholder={`الخيار ${index+1}`} required={index<2}/>{options.length>2&&<button type="button" onClick={()=>setOptions(current=>current.filter((_,i)=>i!==index))} aria-label={`حذف الخيار ${index+1}`}><X size={17}/></button>}</div>)}</div>
      {options.length<8&&<button type="button" className="channel-add-option" onClick={()=>setOptions(current=>[...current,''])}><Plus size={16}/> إضافة خيار</button>}
      <button className="primary-button channel-poll-submit" disabled={busy} type="submit"><BarChart3 size={17}/>{busy?'جارٍ النشر…':'نشر الاستفتاء'}</button>
    </>}
    {error&&<p className="form-error" role="alert">{error}</p>}
  </form>;
}
