import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, AudioLines, BookOpen, Check, Clock3, FileQuestion, Globe2, ImagePlus, LockKeyhole, Mic, Plus, RefreshCw, Search, Send, Square, Trash2, UserRound, Users, Volume2, X } from 'lucide-react';
import { api, json } from './api.js';
import './questions.css';

const TOPICS=['الفقه','الأصول','النحو','المنطق','العقائد','اللغة العربية','أخرى'];
const prettyDate=date=>new Intl.DateTimeFormat('ar-IQ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(date));
const short=(value,max=125)=>value?.length>max?`${value.slice(0,max)}…`:value;

export default function Questions({role,userId}) {
  const [list,setList]=useState([]);
  const [teachers,setTeachers]=useState([]);
  const [filter,setFilter]=useState(role==='student'?'mine':role==='teacher'?'direct':'all');
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState(null);
  const [answers,setAnswers]=useState([]);
  const [creating,setCreating]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const loadList=useCallback(async()=>{
    const items=await api('/questions');setList(items);
  },[]);
  useEffect(()=>{
    let alive=true;
    const load=async()=>{
      try {const [items,faculty]=await Promise.all([api('/questions'),role==='student'?api('/questions/teachers'):Promise.resolve([])]);
        if(alive){setList(items);setTeachers(faculty);setError('');}}
      catch(e){if(alive)setError(e.message);}
      finally{if(alive)setLoading(false);}
    };
    load(); const timer=setInterval(()=>{if(alive)loadList().catch(()=>{});},20000);
    return()=>{alive=false;clearInterval(timer);};
  },[role,loadList]);
  const openQuestion=async item=>{
    setError('');setCreating(false);setBusy(true);
    try {const [question,replies]=await Promise.all([api(`/questions/${item.id}`),api(`/questions/${item.id}/answers`)]);
      setSelected(question);setAnswers(replies);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const reloadAnswers=async()=>{if(!selected)return;const [question,replies]=await Promise.all([api(`/questions/${selected.id}`),api(`/questions/${selected.id}/answers`)]);setSelected(question);setAnswers(replies);await loadList();};
  const submitted=async payload=>{
    const result=await json('/questions','POST',payload);setCreating(false);setNotice('تم إرسال السؤال للأساتذة المعنيين. السؤال لا يظهر للطلاب قبل نشر إجابة عامة.');await loadList();await openQuestion({id:result.id});
  };
  const shown=list.filter(q=>{
    const scope=role==='student'?(filter==='mine'?q.isMine:q.published):
      role==='teacher'?(filter==='direct'?q.audience==='teacher'&&q.teacherId===userId:filter==='general'?q.audience==='all':q.published):
      (filter==='all'?true:filter==='general'?q.audience==='all':filter==='direct'?q.audience==='teacher':q.published);
    const word=search.trim().toLocaleLowerCase('ar');
    return scope&&(!word||`${q.title} ${q.body} ${q.topic} ${q.teacherName||''}`.toLocaleLowerCase('ar').includes(word));
  });
  const tabs=role==='student'?[['mine','أسئلتي'],['published','الأسئلة العامة']]:role==='teacher'?[['direct','موجّهة إليّ'],['general','أسئلة عامة'],['published','المكتبة المنشورة']]:[['all','جميع الأسئلة'],['general','الموجّهة للجميع'],['direct','الموجّهة للأساتذة'],['published','المنشورة']];
  return <section className="qa-shell" dir="rtl">
    <div className="qa-head">
      <div><span className="qa-eyebrow">المدرسة / التواصل العلمي</span><h3>الأسئلة والأجوبة</h3><p>{role==='student'?'اسأل أساتذتك وتابع إجاباتهم في مكان واحد.':role==='teacher'?'أجب عن أسئلة طلابك، كتابةً أو بصورة أو بصمة صوتية.':'اطلع على كل الأسئلة والإجابات، وأجب عن الأسئلة الموجّهة للجميع.'}</p></div>
      {role==='student'&&<button type="button" className="primary-button qa-create" onClick={()=>{setSelected(null);setCreating(true);setNotice('');setError('');}}><Plus size={18}/> سؤال جديد</button>}
    </div>
    {notice&&<div role="status" className="qa-banner qa-success"><Check size={19}/>{notice}<button type="button" onClick={()=>setNotice('')} aria-label="إخفاء التنبيه"><X size={17}/></button></div>}
    {error&&<div role="alert" className="qa-banner qa-danger">{error}<button type="button" onClick={()=>setError('')} aria-label="إغلاق التنبيه"><X size={17}/></button></div>}
    {creating&&role==='student'?<NewQuestion teachers={teachers} onCancel={()=>setCreating(false)} onSubmit={submitted}/>:
    selected?<QuestionDetail key={selected.id} question={selected} answers={answers} role={role} userId={userId} onBack={()=>{setSelected(null);setNotice('');loadList().catch(()=>{});}} onReply={async body=>{const result=await api(`/questions/${selected.id}/answers`,{method:'POST',body});await reloadAnswers();setNotice(result.visibility==='public'?'نُشرت الإجابة للجميع وأصبح السؤال متاحاً في المكتبة العامة.':'أُرسلت الإجابة الخاصة للطالب فقط، مع إمكانية مراجعتها للإدارة.');}} onRefresh={reloadAnswers}/>:
    <>
      <div className="qa-overview">
        <div><FileQuestion size={22}/><strong>{list.filter(q=>q.isMine).length|| (role==='student'?0:list.length)}</strong><small>{role==='student'?'أسئلتي':'الأسئلة المتاحة'}</small></div>
        <div><Globe2 size={22}/><strong>{list.filter(q=>q.published).length}</strong><small>أجوبة منشورة</small></div>
        <div><Clock3 size={22}/><strong>{list.filter(q=>!q.published).length}</strong><small>{role==='student'?'لم تُنشر للعامة':'غير منشورة للعامة'}</small></div>
      </div>
      <div className="qa-library">
        <div className="qa-library-top"><h4>صندوق الأسئلة</h4><button type="button" className="qa-refresh" onClick={()=>loadList().catch(e=>setError(e.message))}><RefreshCw size={17}/> تحديث</button></div>
        <div className="qa-filters" role="group" aria-label="تصنيف الأسئلة">{tabs.map(([id,label])=><button key={id} type="button" onClick={()=>setFilter(id)} className={filter===id?'selected':''} aria-pressed={filter===id}>{label}</button>)}</div>
        <label className="qa-search"><Search size={20}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بعنوان السؤال أو محتواه..." aria-label="البحث عن سؤال"/></label>
        {loading?<p className="qa-empty">جارٍ تحميل الأسئلة…</p>:busy?<p className="qa-empty">جارٍ فتح السؤال…</p>:shown.length?<div className="qa-items">{shown.map(q=><button type="button" className="qa-item" onClick={()=>openQuestion(q)} key={q.id}>
          <div className="qa-item-heading"><span className="qa-topic">{q.topic}</span><span className={`qa-status ${q.published?'published':'pending'}`}>{q.published?'إجابة عامة منشورة':q.answerCount?'توجد إجابة خاصة':'بانتظار النشر'}</span></div>
          <strong>{q.title}</strong><p>{short(q.body)}</p><div className="qa-item-footer"><span>{q.audience==='all'?<><Users size={14}/> إلى جميع الأساتذة والإدارة</>:<><UserRound size={14}/> إلى {q.teacherName||'أستاذ محدد'}</>}</span><span>{prettyDate(q.createdAt)}</span></div>
        </button>)}</div>:<div className="qa-empty"><BookOpen size={28}/><p>ماكو أسئلة ضمن هذا القسم حالياً.</p></div>}
      </div>
    </>}
  </section>;
}

function NewQuestion({teachers,onCancel,onSubmit}) {
  const [topic,setTopic]=useState('الفقه');const [target,setTarget]=useState('all');const [teacherId,setTeacherId]=useState('');
  const [title,setTitle]=useState('');const [body,setBody]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const submit=async e=>{e.preventDefault();if(target==='teacher'&&!teacherId)return setError('اختر الأستاذ الذي تريد إرسال السؤال إليه.');setBusy(true);setError('');try{await onSubmit({topic,teacherId:target==='all'?null:teacherId,title:title.trim(),body:body.trim()});}catch(err){setError(err.message)}finally{setBusy(false)}};
  return <section className="qa-panel"><div className="qa-panel-head"><h4>طرح سؤال جديد</h4><button type="button" className="qa-back" onClick={onCancel}><ArrowRight size={18}/> رجوع</button></div>
    <form className="qa-form" onSubmit={submit}>
      <label>موضوع السؤال<select value={topic} onChange={e=>setTopic(e.target.value)}>{TOPICS.map(t=><option key={t}>{t}</option>)}</select></label>
      <fieldset className="qa-choices"><legend>إلى من تريد إرسال السؤال؟</legend><label><input type="radio" checked={target==='all'} onChange={()=>setTarget('all')}/> جميع الأساتذة والإدارة</label><label><input type="radio" checked={target==='teacher'} onChange={()=>setTarget('teacher')}/> أستاذ محدد</label></fieldset>
      {target==='teacher'&&<label>اختر الأستاذ<select value={teacherId} onChange={e=>setTeacherId(e.target.value)} required><option value="">اختر من أساتذة قنواتك…</option>{teachers.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select>{teachers.length===0&&<small>لا يوجد أساتذة لقنوات انضممت إليها حالياً.</small>}</label>}
      <label>عنوان السؤال<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} placeholder="مثال: ما حكم الشك بعد الصلاة؟" required /></label>
      <label>تفاصيل السؤال<textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={5000} rows={6} placeholder="اكتب سؤالك بالتفصيل حتى يتمكن الأستاذ من الإجابة…" required /></label>
      <div className="qa-privacy-note"><LockKeyhole size={20}/><p><strong>خصوصية سؤالك:</strong> لن يراه بقية الطلاب حتى ينشر أحد الأساتذة إجابة عامة. وإذا اخترت أستاذاً محدداً، فلن يجيب عنه غيره، مع قدرة الإدارة على المراجعة.</p></div>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="qa-actions"><button type="button" className="secondary-button" onClick={onCancel}>إلغاء</button><button className="primary-button" disabled={busy||!title.trim()||!body.trim()||target==='teacher'&&!teacherId}><Send size={17}/>{busy?'جارٍ الإرسال…':'إرسال السؤال'}</button></div>
    </form>
  </section>;
}

function QuestionDetail({question,answers,role,userId,onBack,onReply,onRefresh}) {
  return <div className="qa-detail"><button className="qa-back" type="button" onClick={onBack}><ArrowRight size={18}/> العودة إلى الأسئلة</button>
    <article className="qa-panel qa-question"><div className="qa-detail-top"><span className="qa-topic">{question.topic}</span><span className={`qa-status ${question.published?'published':'pending'}`}>{question.published?'منشور للطلاب':'داخلي وغير منشور'}</span></div>
      <h4>{question.title}</h4><p className="qa-question-text">{question.body}</p>
      <div className="qa-meta">{question.studentName&&role==='admin'&&<span><UserRound size={16}/> الطالب: {question.studentName}</span>}<span>{question.audience==='all'?<><Users size={16}/> إلى جميع الأساتذة والإدارة</>:<><UserRound size={16}/> إلى الأستاذ {question.teacherName||'المختار'}</>}</span><span>{prettyDate(question.createdAt)}</span></div>
      {role==='admin'&&question.audience==='teacher'&&<div className="qa-privacy-note"><LockKeyhole size={19}/><p>هذا السؤال موجّه لأستاذ محدد؛ تستطيع مراجعته وإجاباتِه لكن لا تستطيع الرد عليه.</p></div>}
    </article>
    <div className="qa-replies-header"><h4>الإجابات ({answers.length})</h4><button type="button" className="qa-refresh" onClick={()=>onRefresh().catch(()=>{})}><RefreshCw size={16}/> تحديث</button></div>
    {answers.length?<div className="qa-replies">{answers.map(a=><article className="qa-reply" key={a.id}>
      <div className="qa-reply-head"><div className="qa-avatar">{a.authorName?.[0]||'أ'}</div><div><strong>{a.authorName}</strong><small>{prettyDate(a.createdAt)}</small></div><span className={`qa-status ${a.visibility==='public'?'published':'private'}`}>{a.visibility==='public'?<><Globe2 size={14}/> عامة</>:<><LockKeyhole size={14}/> خاصة</>}</span></div>
      {a.body&&<p className="qa-reply-text">{a.body}</p>}
      {a.imageUrl&&<a href={a.imageUrl} target="_blank" rel="noreferrer" title="فتح صورة الإجابة"><img className="qa-reply-image" src={a.imageUrl} loading="lazy" alt="الصورة المرفقة بإجابة الأستاذ" /></a>}
      {a.audioUrl&&<div className="qa-reply-audio"><Volume2 size={17}/><audio controls preload="none" src={a.audioUrl}>متصفحك لا يدعم الاستماع إلى البصمة.</audio></div>}
    </article>)}</div>:<div className="qa-empty"><Clock3 size={26}/><p>ماكو إجابات متاحة بعد.</p></div>}
    {question.canAnswer&&<AnswerComposer key={question.id} onSubmit={onReply} question={question}/>}
    {role==='student'&&<div className="qa-privacy-note"><LockKeyhole size={18}/><p>الإجابة الخاصة يشوفها صاحب السؤال والأستاذ الذي كتبها والإدارة فقط. أما الإجابات العامة فتظهر لجميع الطلاب.</p></div>}
  </div>;
}

function AnswerComposer({question,onSubmit}) {
  const [text,setText]=useState('');const [visibility,setVisibility]=useState('private');const [image,setImage]=useState(null);
  const [audio,setAudio]=useState(null);const [recording,setRecording]=useState(false);const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');const recorder=useRef(null);const chunks=useRef([]);
  const [preview,setPreview]=useState('');const [imagePreview,setImagePreview]=useState('');
  useEffect(()=>{if(!audio){setPreview('');return;}const url=URL.createObjectURL(audio);setPreview(url);return()=>URL.revokeObjectURL(url);},[audio]);
  useEffect(()=>{if(!image){setImagePreview('');return;}const url=URL.createObjectURL(image);setImagePreview(url);return()=>URL.revokeObjectURL(url);},[image]);
  useEffect(()=>()=>{if(recorder.current){recorder.current.onstop=null;recorder.current.ondataavailable=null;if(recorder.current.state!=='inactive')recorder.current.stop();recorder.current.stream?.getTracks().forEach(track=>track.stop());}},[]);
  const start=async()=>{
    setError('');setAudio(null);
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return setError('التسجيل من المتصفح غير مدعوم على هذا الجهاز؛ تگدر ترفع ملفاً صوتياً جاهزاً.');
    let stream;
    try {
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const supported=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
      const instance=supported?new MediaRecorder(stream,{mimeType:supported}):new MediaRecorder(stream);
      recorder.current=instance;chunks.current=[];
      instance.ondataavailable=e=>{if(e.data?.size)chunks.current.push(e.data)};
      instance.onstop=()=>{stream.getTracks().forEach(t=>t.stop());setRecording(false);const type=instance.mimeType?.split(';')[0]||'audio/webm';const data=new Blob(chunks.current,{type});
        if(data.size>12*1024*1024){setError('البصمة أكبر من ١٢ ميغابايت؛ سجّل بصمة أقصر.');setAudio(null);}else if(data.size){setAudio(data);}else{setError('لم يُسجّل أي صوت.');}};
      instance.onerror=()=>setError('تعذر تسجيل البصمة.');
      instance.start(300);setRecording(true);
    }catch(e){stream?.getTracks().forEach(t=>t.stop());setError(e?.name==='NotAllowedError'?'اسمح للمتصفح باستخدام الميكروفون.':'تعذر فتح الميكروفون، جرّب رفع ملف صوتي جاهز.');}
  };
  const stop=()=>{if(recorder.current?.state==='recording')recorder.current.stop();};
  const submit=async e=>{e.preventDefault();if(recording)return setError('أوقف التسجيل واستمع إليه قبل النشر.');if(!text.trim()&&!image&&!audio)return setError('أضف كتابة أو صورة أو بصمة صوتية.');
    setError('');setBusy(true);
    try {const body=new FormData();body.set('body',text.trim());body.set('visibility',visibility);if(image)body.set('image',image,image.name);if(audio)body.set('audio',audio,audio.name||`voice.${audio.type.includes('mp4')?'m4a':audio.type.includes('ogg')?'ogg':'webm'}`);
      await onSubmit(body);setText('');setImage(null);setAudio(null);setVisibility('private');}
    catch(err){setError(err.message);}finally{setBusy(false);}
  };
  return <section className="qa-panel qa-composer"><div className="qa-panel-head"><h4>إضافة إجابة</h4><span className="qa-subtitle">يمكن إضافة عدة إجابات لنفس السؤال</span></div><form className="qa-form" onSubmit={submit}>
    <label>الإجابة المكتوبة <small>اختيارية إذا أرفقت صورة أو بصمة</small><textarea value={text} onChange={e=>setText(e.target.value)} rows={5} maxLength={8000} placeholder="اكتب شرحك للطالب هنا…" /></label>
    <div className="qa-attachments">
      <label className="qa-upload"><ImagePlus size={20}/><span>{image?image.name:'إضافة صورة إلى نفس الإجابة'}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0]||null;if(file&&!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('اختر صورة بصيغة JPG أو PNG أو WebP.');e.target.value='';return;}if(file&&file.size>5*1024*1024){setError('الصورة يجب ألا تتجاوز ٥ ميغابايت.');e.target.value='';return;}setError('');setImage(file);}}/></label>
      {image&&<button type="button" className="qa-clear" onClick={()=>setImage(null)}><Trash2 size={15}/> حذف الصورة</button>}
    </div>
    {imagePreview&&<img className="qa-upload-preview" src={imagePreview} alt="معاينة الصورة قبل إرسالها"/>}
    <div className="qa-recorder"><div className="qa-record-head"><AudioLines size={20}/><strong>بصمة صوتية (اختيارية)</strong></div>
      {recording?<div className="qa-record-controls"><span className="qa-recording-dot">جارٍ التسجيل…</span><button className="secondary-button" type="button" onClick={stop}><Square size={15}/> إيقاف التسجيل</button></div>:
      <div className="qa-record-controls"><button type="button" className="secondary-button" disabled={busy} onClick={start}><Mic size={17}/>{audio?'إعادة تسجيل البصمة':'تسجيل بصمة'}</button><label className="qa-audio-upload">أو اختر بصمة جاهزة <input type="file" accept="audio/*" onChange={e=>{const file=e.target.files?.[0];if(file&&file.size>12*1024*1024){setError('الصوت يجب ألا يتجاوز ١٢ ميغابايت.');e.target.value='';return;}setAudio(file||null);}}/></label></div>}
      {preview&&<div className="qa-preview-audio"><p><Volume2 size={16}/> استمع للبصمة قبل نشرها؛ لن تُرسل تلقائياً.</p><audio controls src={preview}/><button className="qa-clear" type="button" onClick={()=>setAudio(null)}><Trash2 size={15}/> حذف البصمة</button></div>}
      {!preview&&<small>بعد إيقاف التسجيل راح يظهر مشغّل للاستماع، وتگدر تحذفه أو تعيد تسجيله.</small>}
    </div>
    <fieldset className="qa-choices qa-visibility"><legend>من يستطيع مشاهدة الإجابة بعد النشر؟</legend><label className={visibility==='private'?'qa-selected':''}><input type="radio" name="qa-answer-visibility" checked={visibility==='private'} onChange={()=>setVisibility('private')}/><LockKeyhole size={18}/><span><strong>إجابة خاصة</strong><small>الطالب صاحب السؤال والأستاذ صاحب الإجابة والإدارة فقط</small></span></label><label className={visibility==='public'?'qa-selected':''}><input type="radio" name="qa-answer-visibility" checked={visibility==='public'} onChange={()=>setVisibility('public')}/><Globe2 size={18}/><span><strong>إجابة عامة</strong><small>تنشر السؤال وإجابتك في المكتبة العامة لجميع الطلبة</small></span></label></fieldset>
    {visibility==='public'&&<div className="qa-privacy-note"><Globe2 size={20}/><p>تنبيه: اختيار «عامة» سينشر نص السؤال والعنوان وإجابتك لجميع الطلاب، بدون إظهار اسم الطالب.</p></div>}
    {error&&<p role="alert" className="form-error">{error}</p>}
    <button type="submit" className="primary-button qa-send" disabled={busy||recording||(!text.trim()&&!image&&!audio)}><Send size={17}/>{busy?'جارٍ نشر الإجابة…':visibility==='public'?'نشر الإجابة للجميع':'إرسال إجابة خاصة'}</button>
    </form></section>;
}
