import React, {useEffect,useMemo,useState} from 'react';
import {ClipboardCheck, CalendarDays, FileSpreadsheet, UsersRound, BookOpenCheck, Save, CheckCheck, Plus, RotateCcw, PencilLine, Search, AlertCircle, RefreshCw} from 'lucide-react';
import {api,json} from './api.js';
import AttendanceHistory from './AttendanceHistory.jsx';
import './attendance.css';

const today=()=>{const now=new Date(),local=new Date(now.getTime()-now.getTimezoneOffset()*60000);return local.toISOString().slice(0,10);};
const monthToday=()=>today().slice(0,7);
const formatDay=value=>new Intl.DateTimeFormat('ar-IQ',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
const cleanCsv=v=>'"'+String(v??'').replaceAll('"','""')+'"';
function exportCsv(report){
 const lines=[['الشعبة','اسم الطالب','الغيابات','التأخيرات','الحضور','الشهر'].map(cleanCsv).join(',')];
 for(const group of report.groups)for(const s of group.students)lines.push([group.name,s.name,s.absences,s.delays,s.presents,report.month].map(cleanCsv).join(','));
 const blob=new Blob(['\ufeff',lines.join('\r\n')],{type:'text/csv;charset=utf-8;'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`attendance-${report.month}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function Attendance({subjects=[],initialLessonId=null}){
 const [tab,setTab]=useState('register'),[groups,setGroups]=useState([]),[groupId,setGroupId]=useState(''),[lessonDate,setLessonDate]=useState(today()),[period,setPeriod]=useState(1),[subject,setSubject]=useState(''),[roster,setRoster]=useState([]),[statuses,setStatuses]=useState({}),[existingId,setExistingId]=useState(null),[finalized,setFinalized]=useState(false),[lessons,setLessons]=useState([]),[month,setMonth]=useState(monthToday()),[filterGroup,setFilterGroup]=useState(''),[report,setReport]=useState(null),[students,setStudents]=useState([]),[search,setSearch]=useState(''),[selectedStudent,setSelectedStudent]=useState(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const subjectOptions=useMemo(()=>[...new Set(subjects.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')),[subjects]);
 const [groupsReady,setGroupsReady]=useState(false);
 useEffect(()=>{api('/attendance/groups').then(rows=>{setGroups(rows);setGroupsReady(true);}).catch(e=>{setError(e.message);setGroupsReady(true);});},[]);
 useEffect(()=>{if(!initialLessonId)return;openLesson(initialLessonId).catch(()=>{});},[initialLessonId]);
 useEffect(()=>{
   if(!groupId || !lessonDate)return;
   let alive=true;setLoading(true);
   Promise.all([api(`/attendance/groups/${groupId}/roster`),api(`/attendance/lessons?groupId=${encodeURIComponent(groupId)}&date=${lessonDate}`)])
     .then(([info,records])=>{if(!alive)return;setLessons(records);setRoster(current=>existingId?current:info.students);})
     .catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});
   return()=>{alive=false;};
 },[groupId,lessonDate,existingId]);
 async function refreshDay(){if(!groupId)return;const [info,records]=await Promise.all([api(`/attendance/groups/${groupId}/roster`),api(`/attendance/lessons?groupId=${groupId}&date=${lessonDate}`)]);setLessons(records);if(!existingId)setRoster(info.students);}
 function changeGroup(value){setGroupId(value);setExistingId(null);setFinalized(false);setStatuses({});setSubject('');setPeriod(1);setNotice('');setError('');setRoster([]);}
 function changeDate(value){setLessonDate(value);setExistingId(null);setFinalized(false);setStatuses({});setRoster([]);setNotice('');setError('');}
 async function startNew(){setExistingId(null);setStatuses({});setFinalized(false);setSubject('');setPeriod(1);setNotice('');setError('');if(groupId){try{const info=await api(`/attendance/groups/${groupId}/roster`);setRoster(info.students);}catch(e){setError(e.message);}}}
 async function openLesson(id){setError('');setNotice('');setLoading(true);try{
   const data=await api(`/attendance/lessons/${id}`);
   setTab('register');setExistingId(data.lesson.id);setGroupId(data.lesson.groupId||'');setLessonDate(data.lesson.lessonDate);setPeriod(data.lesson.period);setSubject(data.lesson.subject);setFinalized(data.lesson.finalized);
   setRoster(data.students);setStatuses(Object.fromEntries(data.students.map(s=>[s.id,s.status])));
 }catch(e){setError(e.message);throw e;}finally{setLoading(false);}}
 function statusOf(id){return statuses[id]||'present';}
 function toggle(id,next){setStatuses(prev=>({...prev,[id]:(prev[id]||'present')===next?'present':next}));setNotice('');}
 const counts=useMemo(()=>roster.reduce((v,s)=>{v[statuses[s.id]||'present']++;return v;},{present:0,late:0,absent:0}),[roster,statuses]);
 async function submit(finalize){
   setError('');setNotice('');
   if(!groupId||!subject.trim()||!roster.length){setError('اختر الشعبة والمادة، وتأكد أن بها طلاباً.');return;}
   if(finalize&&!window.confirm(`اعتماد سجل ${subject} للحصة ${period}؟ الغائبون: ${counts.absent}، والمتأخرون: ${counts.late}. يمكن للإدارة تصحيحه لاحقاً.`))return;
   setBusy(true);
   try{const result=await json('/attendance/lessons','POST',{groupId,lessonId:existingId,lessonDate,period:Number(period),subject:subject.trim(),finalize,entries:roster.map(s=>({studentId:s.id,status:statusOf(s.id)}))});
     setExistingId(result.id);setFinalized(x=>x||finalize);await refreshDay();setNotice(finalize?'تم اعتماد الغياب، وظهرت نتائجه في حسابات الطلاب والتقارير.':'تم حفظ المسودة؛ لم تدخل في التقارير بعد.');
   }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function loadReport(){setError('');setLoading(true);try{setReport(await api(`/attendance/report?month=${month}${filterGroup?`&groupId=${filterGroup}`:''}`));}catch(e){setError(e.message);}finally{setLoading(false);}}
 useEffect(()=>{if(tab==='report')loadReport();},[tab,month,filterGroup]);
 useEffect(()=>{if(tab==='students')api('/attendance/students').then(setStudents).catch(e=>setError(e.message));},[tab]);
 const filteredStudents=students.filter(s=>(s.name+' '+s.email).toLowerCase().includes(search.trim().toLowerCase()));
 return <div className="attendance-screen">
    <div className="attendance-topline"><div><span className="overline">تنظيم المدرسة</span><h3>الحضور والغياب</h3><p>كل درس مرتبط بتاريخ وشعبة ومادة ورقم حصة. التسجيل متاح لحسابات الإدارة فقط.</p></div><ClipboardCheck size={31}/></div>
    <div className="attendance-tabs" role="tablist" aria-label="أقسام الحضور والغياب"><button role="tab" aria-selected={tab==='register'} className={tab==='register'?'active':''} onClick={()=>{setTab('register');setError('');}}><BookOpenCheck size={18}/> تسجيل الحضور</button><button role="tab" aria-selected={tab==='report'} className={tab==='report'?'active':''} onClick={()=>{setTab('report');setError('');}}><FileSpreadsheet size={18}/> التقارير الشهرية</button><button role="tab" aria-selected={tab==='students'} className={tab==='students'?'active':''} onClick={()=>{setTab('students');setError('');}}><UsersRound size={18}/> سجل الطلاب</button></div>
    {error&&<div className="cloud-error" role="alert">{error}</div>}{notice&&<p className="attendance-notice" role="status">{notice}</p>}
    {tab==='register'&&<section className="section-block attendance-panel">
      <div className="section-head"><div><h3>{existingId?'تعديل سجل حصة':'تسجيل حصة جديدة'}</h3><p>غير المحدد يُحتسب حاضراً تلقائياً عند الحفظ.</p></div>{existingId&&<button className="attendance-small-button" type="button" onClick={startNew}><Plus size={17}/> حصة جديدة</button>}</div>
      <div className="attendance-fields"><label>الشعبة<select value={groupId} onChange={e=>changeGroup(e.target.value)} disabled={Boolean(existingId)}><option value="">اختر الشعبة…</option>{groups.map(g=><option value={g.id} key={g.id}>{g.name} ({g.studentCount} طالب)</option>)}</select></label><label>التاريخ<input type="date" value={lessonDate} onChange={e=>changeDate(e.target.value)} disabled={Boolean(existingId)}/></label><label>رقم الحصة<select value={period} onChange={e=>setPeriod(Number(e.target.value))} disabled={Boolean(existingId)}>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>الحصة {i+1}</option>)}</select></label><label>المادة<input value={subject} onChange={e=>setSubject(e.target.value)} list="attendance-subjects" maxLength="100" placeholder="مثلاً: الفقه"/><datalist id="attendance-subjects">{subjectOptions.map(s=><option value={s} key={s}/>)}</datalist></label></div>
      {existingId&&<p className={`attendance-record-state ${finalized?'final':'draft'}`}>{finalized?'سجل معتمد — أي تعديل عليه يظهر في التقارير مباشرة.':'مسودة محفوظة — لا تُحتسب حتى تعتمدها.'}</p>}
      {!groupsReady?<p className="scope-note">جارٍ تحميل الشعب…</p>:!groups.length?<p className="quiet-empty">ماكو شعب لحد الآن. أنشئ شعبة من قسم «الطلاب» وأضف إليها الطلبة.</p>:null}
      {groupId&&<><div className="attendance-day-list"><div className="attendance-inline-head"><strong>حصص هذه الشعبة في {formatDay(lessonDate)}</strong><button type="button" className="attendance-small-button" onClick={()=>refreshDay().catch(e=>setError(e.message))}><RefreshCw size={15}/> تحديث</button></div>{lessons.length?<div className="attendance-lesson-chips">{lessons.map(item=><button type="button" key={item.id} onClick={()=>openLesson(item.id).catch(()=>{})} className={existingId===item.id?'selected':''}>{item.subject} · حصة {item.period} {item.finalized?'✓':'(مسودة)'}</button>)}</div>:<p className="scope-note">ماكو حصص محفوظة لهذا اليوم بعد.</p>}</div>
      <div className="attendance-roster-head"><div><h4>طلاب الشعبة</h4><p>{roster.length} طالب · اختر غائب أو متأخر، أو اترك الاثنين بدون تحديد للحاضر.</p></div><span>{loading?'جارٍ التحديث…':''}</span></div>
      {roster.length?<><div className="attendance-table"><div className="attendance-table-header"><span>اسم الطالب</span><span>متأخر</span><span>غائب</span></div>{roster.map((person,i)=>{const status=statusOf(person.id);return <div className="attendance-person" key={person.id}><div className="attendance-person-name"><small>{i+1}</small><div><strong>{person.name}</strong><span className={`attendance-label ${status}`}>{status==='late'?'متأخر':status==='absent'?'غائب':'حاضر'}</span></div></div><button type="button" className={`attendance-radio late ${status==='late'?'active':''}`} aria-pressed={status==='late'} aria-label={`${person.name}: متأخر`} onClick={()=>toggle(person.id,'late')}><span/></button><button type="button" className={`attendance-radio absent ${status==='absent'?'active':''}`} aria-pressed={status==='absent'} aria-label={`${person.name}: غائب`} onClick={()=>toggle(person.id,'absent')}><span/></button></div>;})}</div>
      <div className="attendance-metrics"><div className="attendance-metric good"><strong>{counts.present}</strong><span>حاضر</span></div><div className="attendance-metric warning"><strong>{counts.late}</strong><span>متأخر</span></div><div className="attendance-metric danger"><strong>{counts.absent}</strong><span>غائب</span></div></div><div className="attendance-actions">{!finalized&&<button type="button" className="secondary-button" onClick={()=>submit(false)} disabled={busy||loading}><Save size={17}/> حفظ مسودة</button>}<button type="button" className="primary-button" onClick={()=>submit(true)} disabled={busy||loading}><CheckCheck size={17}/> {finalized?'حفظ التعديلات':'اعتماد الحضور والغياب'}</button></div></>:<p className="quiet-empty">لا يوجد طلاب في هذه الشعبة. أضف الطلاب إليها من قسم «الطلاب».</p>}</>}
    </section>}
    {tab==='report'&&<section className="section-block attendance-panel"><div className="section-head"><div><h3>التقرير الشهري حسب الشعب</h3><p>جدول مستقل لكل شعبة، ويُحتسب كل تأخير بشكل منفصل.</p></div></div><div className="attendance-report-tools"><label>شهر التقرير<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><label>الشعبة<select value={filterGroup} onChange={e=>setFilterGroup(e.target.value)}><option value="">كل الشعب</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><button type="button" className="secondary-button" onClick={loadReport} disabled={loading}><RotateCcw size={17}/> تحديث</button><button type="button" className="primary-button" disabled={!report||loading} onClick={()=>exportCsv(report)}><FileSpreadsheet size={17}/> تصدير Excel (CSV)</button></div>{loading&&<p className="scope-note">جارٍ إعداد التقرير…</p>}
      {report?.groups.map(group=><div className="attendance-report-group" key={group.id}><div className="attendance-report-heading"><div><h4>{group.name}</h4><span>{group.students.length} طالب · شهر {report.month}</span></div><span className="attendance-report-total">غيابات: {group.students.reduce((a,s)=>a+s.absences,0)} · تأخيرات: {group.students.reduce((a,s)=>a+s.delays,0)}</span></div>{group.students.length?<div className="attendance-report-scroll"><table><thead><tr><th>#</th><th>اسم الطالب</th><th>غياب</th><th>تأخير</th><th>حضور</th></tr></thead><tbody>{group.students.map((s,i)=><tr key={s.id}><td>{i+1}</td><td>{s.name}</td><td className={s.absences?'attendance-number-absent':''}>{s.absences}</td><td className={s.delays?'attendance-number-late':''}>{s.delays}</td><td>{s.presents}</td></tr>)}</tbody></table></div>:<p className="quiet-empty">لا يوجد طلاب بهذه الشعبة.</p>}</div>)}{report&&!report.groups.length&&<p className="quiet-empty">لا توجد شُعب مطابقة للتقرير.</p>}<p className="scope-note">الغياب والتأخير يُحسبان بعدد الحصص، وليس بعدد الأيام. المسودات لا تدخل بالتقرير.</p>
    </section>}
    {tab==='students'&&<section className="section-block attendance-panel"><div className="section-head"><div><h3>سجل الطلاب</h3><p>إجمالي غيابات وتأخيرات كل طالب في جميع الحصص المعتمدة.</p></div></div><label className="attendance-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم الطالب أو بريده"/></label>{selectedStudent?<><button className="back-button" type="button" onClick={()=>setSelectedStudent(null)}>العودة إلى سجل الطلاب</button><AttendanceHistory studentId={selectedStudent.id} onEditLesson={id=>openLesson(id).catch(()=>{})}/></>:<div className="attendance-student-list">{filteredStudents.map(s=><button type="button" key={s.id} className="attendance-student-row" onClick={()=>setSelectedStudent(s)}><strong>{s.name}</strong><span>غياب: <b className="attendance-number-absent">{s.absences}</b></span><span>تأخير: <b className="attendance-number-late">{s.delays}</b></span><PencilLine size={16}/></button>)}{!filteredStudents.length&&<p className="quiet-empty">ماكو طلاب مطابقين للبحث.</p>}</div>}</section>}
 </div>;
}
