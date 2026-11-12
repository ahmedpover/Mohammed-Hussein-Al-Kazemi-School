import React, {useEffect,useState} from 'react';
import {CalendarDays, Clock3, AlertCircle, RefreshCw, PencilLine} from 'lucide-react';
import {api,json} from './api.js';
import './attendance.css';
const formatDay=value=>{try{return new Intl.DateTimeFormat('ar-IQ',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));}catch{return value;}};
export default function AttendanceHistory({studentId=null,onEditLesson}){
  const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const path=studentId?`/attendance/students/${studentId}`:'/attendance/me';
  const [saving,setSaving]=useState('');
  const setExcuse=async entry=>{setSaving(entry.lessonId);setError('');try{await json(`/attendance/students/${studentId}/lessons/${entry.lessonId}/excuse`,'PATCH',{excused:!entry.excused});await api(path).then(setData);}catch(e){setError(e.message);}finally{setSaving('');}};
  const reload=()=>{setLoading(true);setError('');api(path).then(setData).catch(e=>setError(e.message)).finally(()=>setLoading(false));};
  useEffect(()=>{let valid=true;setLoading(true);setData(null);api(path).then(res=>{if(valid)setData(res);}).catch(e=>{if(valid)setError(e.message);}).finally(()=>{if(valid)setLoading(false);});return()=>{valid=false;};},[path]);
  return <section className="section-block attendance-history" aria-label="سجل الحضور والغياب">
    <div className="section-head"><div><span className="overline">متابعة الدروس</span><h3>سجل الحضور والغياب</h3><p>كل مادة تُحسب منفصلة، والغياب المجاز لا يدخل ضمن الغيابات.</p></div><button className="attendance-small-button" onClick={reload} type="button" aria-label="تحديث السجل"><RefreshCw size={17}/></button></div>
    {loading&&<p className="scope-note">جارٍ تحميل الغيابات…</p>}{error&&<p className="form-error" role="alert">{error} <button type="button" onClick={reload}>إعادة المحاولة</button></p>}
    {data&&<><div className="attendance-metrics"><div className="attendance-metric danger"><AlertCircle size={21}/><strong>{data.totals.absences||0}</strong><span>غياب غير مجاز</span></div><div className="attendance-metric warning"><Clock3 size={21}/><strong>{data.totals.delays||0}</strong><span>تأخير</span></div><div className="attendance-metric good"><CalendarDays size={21}/><strong>{data.totals.presents||0}</strong><span>حضور مسجّل</span></div></div>
      <h4>تفاصيل الغياب والتأخير</h4>{data.items?.length?<div className="attendance-history-list">{data.items.map((entry,i)=><article className="attendance-history-row" key={`${entry.lessonId}-${i}`}><div><strong>{formatDay(entry.lessonDate)}</strong><span>{entry.groupName} · {entry.subject}</span></div><span className={`attendance-tag ${entry.status}`}>{entry.status==='absent'?(entry.excused?'مجاز':'غائب'):'متأخر'}</span>{studentId&&entry.status==='absent'&&<button type="button" className="attendance-small-button" disabled={saving===entry.lessonId} onClick={()=>setExcuse(entry)}>{entry.excused?'إلغاء الإجازة':'مجاز'}</button>}{onEditLesson&&<button type="button" className="attendance-small-button" onClick={()=>onEditLesson(entry.lessonId)} title="تعديل سجل الحصة"><PencilLine size={16}/> تعديل</button>}</article>)}</div>:<p className="quiet-empty">ما عندك غيابات أو تأخيرات في السجلات المعتمدة.</p>}
      {data.items?.length===1000&&<p className="scope-note">يظهر آخر 1000 تسجيل؛ راجع الإدارة لعرض الأقدم.</p>}
      <p className="scope-note">تظهر هنا المواد التي اعتمدتها الإدارة فقط؛ المسودات لا تدخل بالحساب.</p>
    </>}
  </section>;
}
