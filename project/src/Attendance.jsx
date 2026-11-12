import React, {useEffect,useMemo,useState} from 'react';
import {ClipboardCheck, CalendarDays, FileSpreadsheet, UsersRound, BookOpenCheck, Save, CheckCheck, Plus, RotateCcw, PencilLine, Search, AlertCircle, RefreshCw} from 'lucide-react';
import {api,json} from './api.js';
import AttendanceHistory from './AttendanceHistory.jsx';
import './attendance.css';

const today=()=>{const now=new Date(),local=new Date(now.getTime()-now.getTimezoneOffset()*60000);return local.toISOString().slice(0,10);};
const monthToday=()=>today().slice(0,7);
const formatDay=value=>new Intl.DateTimeFormat('ar-IQ',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
const H_NAMES=['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
const hParts=(v)=>{const f=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'});const p=Object.fromEntries(f.formatToParts(new Date(v+'T00:00:00Z')).map(i=>[i.type,i.value]));return {year:Number(p.year),month:Number(p.month),day:Number(p.day)};};
const initialHijri=hParts(today());
const isoPlus=(v,days)=>new Date(Date.parse(v+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
const dayOf=(v,start)=>Math.round((Date.parse(v+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1;

function exportExcel(report){
 import('./attendance-xlsx.js').then(({makeAttendanceWorkbook})=>{
   const blob=makeAttendanceWorkbook(report);
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;
   link.download=`attendance-${report.month}.xlsx`;document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1500);
 }).catch(error=>window.alert(`تعذّر تصدير ملف Excel: ${error.message}`));
}

export default function Attendance({subjects=[],initialLessonId=null,representative=false}){
 const [tab,setTab]=useState('register'),[groups,setGroups]=useState([]),[groupId,setGroupId]=useState(''),[lessonDate,setLessonDate]=useState(today()),[subject,setSubject]=useState(''),[roster,setRoster]=useState([]),[statuses,setStatuses]=useState({}),[existingId,setExistingId]=useState(null),[finalized,setFinalized]=useState(false),[lessons,setLessons]=useState([]),[month,setMonth]=useState(monthToday()),[reportCalendar,setReportCalendar]=useState('hijri'),[reportHijri,setReportHijri]=useState(''),[filterGroup,setFilterGroup]=useState(''),[report,setReport]=useState(null),[students,setStudents]=useState([]),[search,setSearch]=useState(''),[selectedStudent,setSelectedStudent]=useState(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const subjectOptions=useMemo(()=>[...new Set(subjects.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')),[subjects]);
 const [groupsReady,setGroupsReady]=useState(false);
 const [hijriMonths,setHijriMonths]=useState([]),[hYear,setHYear]=useState(String(initialHijri.year)),[dateMonth,setDateMonth]=useState(initialHijri.month),[dateDay,setDateDay]=useState(initialHijri.day),[editMonths,setEditMonths]=useState(false),[editingMonth,setEditingMonth]=useState(null),[editingDays,setEditingDays]=useState(30),[editingStart,setEditingStart]=useState(''),[hSource,setHSource]=useState('');
 const loadHijri=(year=Number(hYear))=>api(`/attendance/${representative?'hijri-calendar':'hijri-months'}?year=${year}`).then(setHijriMonths);
 useEffect(()=>{let active=true;setHijriMonths([]);api(`/attendance/${representative?'hijri-calendar':'hijri-months'}?year=${hYear}`).then(list=>{if(active)setHijriMonths(list);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[hYear]);
 const currentMonth=hijriMonths.find(m=>Number(m.month)===Number(dateMonth));
 const selectedHijriMonth=hijriMonths.find(m=>lessonDate>=m.startDate&&lessonDate<=m.endDate);
 const hijriDate=(value)=>{const found=hijriMonths.find(m=>value>=m.startDate&&value<=m.endDate);if(!found)return 'التاريخ الهجري غير متوفر لهذه السنة';return `${dayOf(value,found.startDate)} ${H_NAMES[Number(found.month)-1]} ${found.year} هـ`;};
 const setHijriSelection=(m,d)=>{setDateMonth(m);setDateDay(d);const item=hijriMonths.find(x=>Number(x.month)===Number(m));if(item)changeDate(isoPlus(item.startDate,Math.min(Number(d),item.days)-1));};
 async function saveHijri(){setBusy(true);setError('');try{await json('/attendance/hijri-months','PUT',{year:Number(hYear),month:editingMonth,days:Number(editingDays),startDate:editingStart,sourceUrl:hSource});await loadHijri();setEditingMonth(null);setNotice('تم تعديل تقويم المدرسة لجميع الشعب، وتحديث بداية الأشهر التالية تلقائياً.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 function editHijri(m){setEditingMonth(Number(m.month));setEditingDays(m.days);setEditingStart(m.startDate);setHSource(m.sourceUrl||'');}

 useEffect(()=>{if(!hijriMonths.length||existingId)return;const matched=hijriMonths.find(x=>lessonDate>=x.startDate&&lessonDate<=x.endDate);if(matched){setDateMonth(matched.month);setDateDay(dayOf(lessonDate,matched.startDate));return;}const m=hijriMonths.find(x=>Number(x.month)===Number(dateMonth));if(!m)return;const resolved=isoPlus(m.startDate,Math.min(dateDay,m.days)-1);if(resolved!==lessonDate)changeDate(resolved);},[hijriMonths]);
 useEffect(()=>{api('/attendance/groups').then(rows=>{setGroups(rows);if(representative&&rows.length===1)setGroupId(rows[0].id);setGroupsReady(true);}).catch(e=>{setError(e.message);setGroupsReady(true);});},[]);
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
 function changeGroup(value){setGroupId(value);setExistingId(null);setFinalized(false);setStatuses({});setSubject('');setNotice('');setError('');setRoster([]);}
 function changeDate(value){setLessonDate(value);setExistingId(null);setFinalized(false);setStatuses({});setRoster([]);setNotice('');setError('');}
 async function startNew(){setExistingId(null);setStatuses({});setFinalized(false);setSubject('');setNotice('');setError('');if(groupId){try{const info=await api(`/attendance/groups/${groupId}/roster`);setRoster(info.students);}catch(e){setError(e.message);}}}
 async function openLesson(id){setError('');setNotice('');setLoading(true);try{
   const data=await api(`/attendance/lessons/${id}`);
   const baseYear=hParts(data.lesson.lessonDate).year;
   let resolved=null;
   for(const y of [baseYear,baseYear-1,baseYear+1]){
     const months=await api(`/attendance/${representative?'hijri-calendar':'hijri-months'}?year=${y}`);
     resolved=months.find(m=>data.lesson.lessonDate>=m.startDate&&data.lesson.lessonDate<=m.endDate);
     if(resolved)break;
   }
   setTab('register');setExistingId(data.lesson.id);setGroupId(data.lesson.groupId||'');setLessonDate(data.lesson.lessonDate);
   setHYear(String(resolved?.year||baseYear));setDateMonth(resolved?.month||hParts(data.lesson.lessonDate).month);
   setDateDay(resolved?dayOf(data.lesson.lessonDate,resolved.startDate):hParts(data.lesson.lessonDate).day);
   setSubject(data.lesson.subject);setFinalized(data.lesson.finalized);
   setRoster(data.students);setStatuses(Object.fromEntries(data.students.map(s=>[s.id,s.status])));
 }catch(e){setError(e.message);throw e;}finally{setLoading(false);}}
 function statusOf(id){return statuses[id]||'present';}
 function toggle(id,next){setStatuses(prev=>({...prev,[id]:(prev[id]||'present')===next?'present':next}));setNotice('');}
 const counts=useMemo(()=>roster.reduce((v,s)=>{v[statuses[s.id]||'present']++;return v;},{present:0,late:0,absent:0}),[roster,statuses]);
 async function submit(finalize){
   setError('');setNotice('');
   if(!hijriMonths.length||!selectedHijriMonth){setError('التاريخ الهجري غير متوفر؛ اختر سنة وشهراً صحيحين.');return;}
   if(!groupId||!subject.trim()||!roster.length){setError('اختر الشعبة والمادة، وتأكد أن بها طلاباً.');return;}
   if(finalize&&!window.confirm(`اعتماد سجل مادة ${subject}؟ الغائبون: ${counts.absent}، والمتأخرون: ${counts.late}. يمكن للإدارة تصحيحه لاحقاً.`))return;
   setBusy(true);
   try{const result=await json('/attendance/lessons','POST',{groupId,lessonId:existingId,lessonDate,subject:subject.trim(),finalize,entries:roster.map(s=>({studentId:s.id,status:statusOf(s.id)}))});
     setExistingId(result.id);setFinalized(x=>x||finalize);await refreshDay();setNotice(finalize?'تم اعتماد الغياب، وظهرت نتائجه في حسابات الطلاب والتقارير.':'تم حفظ المسودة؛ لم تدخل في التقارير بعد.');
   }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function loadReport(){setError('');setLoading(true);try{setReport(await api(`/attendance/report?${reportCalendar==='hijri'&&reportHijri?`hijriYear=${reportHijri.split('-')[0]}&hijriMonth=${reportHijri.split('-')[1]}`:`month=${month}`}${filterGroup?`&groupId=${filterGroup}`:''}`));}catch(e){setError(e.message);}finally{setLoading(false);}}
 useEffect(()=>{if(!reportHijri&&hijriMonths.length)setReportHijri(`${hYear}-${hijriMonths.find(m=>lessonDate>=m.startDate&&lessonDate<=m.endDate)?.month||1}`);},[hijriMonths,reportHijri,hYear]);
 useEffect(()=>{if(tab==='report'&&(reportCalendar==='gregorian'||reportHijri))loadReport();},[tab,month,filterGroup,reportCalendar,reportHijri]);
 useEffect(()=>{if(tab==='students')api('/attendance/students').then(setStudents).catch(e=>setError(e.message));},[tab]);
 const filteredStudents=students.filter(s=>(s.name+' '+s.email).toLowerCase().includes(search.trim().toLowerCase()));
 return <div className="attendance-screen">
    <div className="attendance-topline"><div><span className="overline">تنظيم المدرسة</span><h3>الحضور والغياب</h3><p>كل سجل مرتبط بتاريخ وشعبة ومادة. {representative?'التسجيل لشعبتك فقط.':'التسجيل متاح للإدارة وممثلي الشعب.'}</p></div><ClipboardCheck size={31}/></div>
    <div className="attendance-tabs" role="tablist" aria-label="أقسام الحضور والغياب"><button role="tab" aria-selected={tab==='register'} className={tab==='register'?'active':''} onClick={()=>{setTab('register');setError('');}}><BookOpenCheck size={18}/> تسجيل الحضور</button>{!representative&&<button role="tab" aria-selected={tab==='report'} className={tab==='report'?'active':''} onClick={()=>{setTab('report');setError('');}}><FileSpreadsheet size={18}/> التقارير الشهرية</button>}{!representative&&<button role="tab" aria-selected={tab==='hijri'} className={tab==='hijri'?'active':''} onClick={()=>{setTab('hijri');setError('');}}><CalendarDays size={18}/> التقويم الهجري</button>}{!representative&&<button role="tab" aria-selected={tab==='students'} className={tab==='students'?'active':''} onClick={()=>{setTab('students');setError('');}}><UsersRound size={18}/> سجل الطلاب</button>}</div>
    {error&&<div className="cloud-error" role="alert">{error}</div>}{notice&&<p className="attendance-notice" role="status">{notice}</p>}
    {tab==='register'&&<section className="section-block attendance-panel">
      <div className="section-head"><div><h3>{existingId?'تعديل سجل مادة':'تسجيل مادة جديدة'}</h3><p>غير المحدد يُحتسب حاضراً تلقائياً عند الحفظ.</p></div>{existingId&&<button className="attendance-small-button" type="button" onClick={startNew}><Plus size={17}/> مادة جديدة</button>}</div>
      <div className="attendance-fields"><label>الشعبة<select value={groupId} onChange={e=>changeGroup(e.target.value)} disabled={Boolean(existingId)}><option value="">اختر الشعبة…</option>{groups.map(g=><option value={g.id} key={g.id}>{g.name} ({g.studentCount} طالب)</option>)}</select></label><label>السنة الهجرية<select value={hYear} onChange={e=>{setHYear(e.target.value);setDateMonth(1);setDateDay(1);setReportHijri('');}} disabled={Boolean(existingId)}>{Array.from({length:5},(_,i)=>initialHijri.year-2+i).map(y=><option key={y} value={y}>{y} هـ</option>)}</select></label><label>الشهر الهجري<select value={dateMonth} onChange={e=>setHijriSelection(Number(e.target.value),1)} disabled={Boolean(existingId)||!hijriMonths.length}>{hijriMonths.map(m=><option key={m.month} value={m.month}>{H_NAMES[m.month-1]}</option>)}</select></label><label>اليوم الهجري<select value={Math.min(Number(dateDay),currentMonth?.days||30)} onChange={e=>setHijriSelection(dateMonth,Number(e.target.value))} disabled={Boolean(existingId)||!currentMonth}>{Array.from({length:currentMonth?.days||30},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label><label>المادة<input value={subject} onChange={e=>setSubject(e.target.value)} list="attendance-subjects" maxLength="100" placeholder="مثلاً: الفقه"/><datalist id="attendance-subjects">{subjectOptions.map(s=><option value={s} key={s}/>)}</datalist></label></div>
      {representative&&finalized&&<p className="scope-note">السجل معتمد؛ التصحيح بعد الاعتماد من صلاحية الإدارة.</p>}
      {existingId&&<p className={`attendance-record-state ${finalized?'final':'draft'}`}>{finalized?'سجل معتمد — أي تعديل عليه يظهر في التقارير مباشرة.':'مسودة محفوظة — لا تُحتسب حتى تعتمدها.'}</p>}
      {!groupsReady?<p className="scope-note">جارٍ تحميل الشعب…</p>:!groups.length?<p className="quiet-empty">ماكو شعب لحد الآن. أنشئ شعبة من قسم «الطلاب» وأضف إليها الطلبة.</p>:null}
      {groupId&&<><div className="attendance-day-list"><div className="attendance-inline-head"><strong>مواد هذه الشعبة في {hijriDate(lessonDate)}</strong><button type="button" className="attendance-small-button" onClick={()=>refreshDay().catch(e=>setError(e.message))}><RefreshCw size={15}/> تحديث</button></div>{lessons.length?<div className="attendance-lesson-chips">{lessons.map(item=><button type="button" key={item.id} onClick={()=>openLesson(item.id).catch(()=>{})} className={existingId===item.id?'selected':''}>{item.subject} {item.finalized?'✓':'(مسودة)'}</button>)}</div>:<p className="scope-note">ماكو مواد محفوظة لهذا اليوم بعد.</p>}</div>
      <div className="attendance-roster-head"><div><h4>طلاب الشعبة</h4><p>{roster.length} طالب · اختر غائب أو متأخر، أو اترك الاثنين بدون تحديد للحاضر.</p></div><span>{loading?'جارٍ التحديث…':''}</span></div>
      {roster.length?<><div className="attendance-table"><div className="attendance-table-header"><span>اسم الطالب</span><span>متأخر</span><span>غائب</span></div>{roster.map((person,i)=>{const status=statusOf(person.id);return <div className="attendance-person" key={person.id}><div className="attendance-person-name"><small>{i+1}</small><div><strong>{person.name}</strong><span className={`attendance-label ${status}`}>{status==='late'?'متأخر':status==='absent'?'غائب':'حاضر'}</span></div></div><button type="button" className={`attendance-radio late ${status==='late'?'active':''}`} aria-pressed={status==='late'} aria-label={`${person.name}: متأخر`} onClick={()=>toggle(person.id,'late')}><span/></button><button type="button" className={`attendance-radio absent ${status==='absent'?'active':''}`} aria-pressed={status==='absent'} aria-label={`${person.name}: غائب`} onClick={()=>toggle(person.id,'absent')}><span/></button></div>;})}</div>
      <div className="attendance-metrics"><div className="attendance-metric good"><strong>{counts.present}</strong><span>حاضر</span></div><div className="attendance-metric warning"><strong>{counts.late}</strong><span>متأخر</span></div><div className="attendance-metric danger"><strong>{counts.absent}</strong><span>غائب</span></div></div><div className="attendance-actions">{!finalized&&<button type="button" className="secondary-button" onClick={()=>submit(false)} disabled={busy||loading||(representative&&finalized)}><Save size={17}/> حفظ مسودة</button>}<button type="button" className="primary-button" onClick={()=>submit(true)} disabled={busy||loading||(representative&&finalized)}><CheckCheck size={17}/> {finalized?'حفظ التعديلات':'اعتماد الحضور والغياب'}</button></div></>:<p className="quiet-empty">لا يوجد طلاب في هذه الشعبة. أضف الطلاب إليها من قسم «الطلاب».</p>}</>}
    </section>}
    {!representative&&tab==='hijri'&&<section className="section-block attendance-panel">
      <div className="section-head attendance-hijri-head"><div><h3>الأشهر الهجرية للمدرسة</h3><p>تقويم واحد ينطبق على جميع الشعب والتقارير وسجلات الطلاب.</p></div><button type="button" className="secondary-button" onClick={()=>{setEditMonths(v=>!v);setEditingMonth(null);}}><PencilLine size={17}/>{editMonths?'إنهاء التعديل':'تعديل الأشهر'}</button></div>
      <div className="attendance-report-tools"><label>السنة الهجرية<select value={hYear} onChange={e=>{setHYear(e.target.value);setEditingMonth(null);setReportHijri('');}}>{Array.from({length:5},(_,i)=>initialHijri.year-2+i).map(y=><option key={y} value={y}>{y} هـ</option>)}</select></label></div>
      <p className="scope-note">تظهر الأشهر الـ12 تلقائياً اعتماداً على تقويم حسابي تقديري. علامة «معدّل إدارياً» تعني أن الإدارة صحّحت بيانات الشهر؛ لا يعني الافتراضي ثبوت الهلال.</p>
      <div className="attendance-report-scroll"><table><thead><tr><th>الشهر</th><th>الأيام</th><th>بدايته (المقابل الميلادي)</th><th>نهايته (المقابل الميلادي)</th><th>الحالة</th>{editMonths&&<th>الإجراء</th>}</tr></thead><tbody>{hijriMonths.map(m=><tr key={`${m.year}-${m.month}`}><td>{H_NAMES[m.month-1]}</td><td>{m.days}</td><td>{m.startDate}</td><td>{m.endDate}</td><td>{m.confirmed?'معدّل إدارياً':'تقديري'}</td>{editMonths&&<td><button type="button" className="attendance-small-button" onClick={()=>editHijri(m)}>تعديل</button></td>}</tr>)}</tbody></table></div>
      {!hijriMonths.length&&<p className="scope-note">جارٍ تجهيز الأشهر الهجرية…</p>}
      {editMonths&&editingMonth&&<div className="attendance-hijri-editor"><h4>تعديل {H_NAMES[editingMonth-1]}</h4><div className="attendance-report-tools"><label>عدد أيام الشهر<select value={editingDays} onChange={e=>setEditingDays(Number(e.target.value))}><option value={29}>29 يوماً</option><option value={30}>30 يوماً</option></select></label><label>بداية الشهر (للتصحيح عند الحاجة)<input type="date" value={editingStart} onChange={e=>setEditingStart(e.target.value)}/></label><label>رابط إعلان الهلال (اختياري)<input value={hSource} onChange={e=>setHSource(e.target.value)} placeholder="رابط إعلان مكتب السيد السيستاني"/></label><button type="button" className="primary-button" disabled={busy} onClick={saveHijri}>حفظ وتطبيق على الجميع</button></div><p className="scope-note">عند تغيير عدد أيام الشهر تتغير تواريخ الأشهر التالية تلقائياً لكل الشعب، ولا تُحذف سجلات الغياب القديمة. لا تجرِ تصحيحاً غير متأكد منه.</p></div>}
    </section>}
    {!representative&&tab==='report'&&<section className="section-block attendance-panel"><div className="section-head"><div><h3>التقرير الشهري حسب الشعب</h3><p>جدول مستقل لكل شعبة، ويُحتسب كل تأخير بشكل منفصل.</p></div></div><div className="attendance-report-tools"><label>نوع التقويم<select value={reportCalendar} onChange={e=>setReportCalendar(e.target.value)}><option value="hijri">هجري حسب تقويم المدرسة</option><option value="gregorian">ميلادي</option></select></label>{reportCalendar==='hijri'?<label>الشهر الهجري<select value={reportHijri} onChange={e=>setReportHijri(e.target.value)}>{hijriMonths.map(m=><option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>{H_NAMES[m.month-1]} {m.year} هـ</option>)}</select></label>:<label>شهر التقرير<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>}<label>الشعبة<select value={filterGroup} onChange={e=>setFilterGroup(e.target.value)}><option value="">كل الشعب</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><button type="button" className="secondary-button" onClick={loadReport} disabled={loading}><RotateCcw size={17}/> تحديث</button><button type="button" className="primary-button" disabled={!report||loading} onClick={()=>exportExcel(report)}><FileSpreadsheet size={17}/> تصدير Excel المنسّق</button></div>{loading&&<p className="scope-note">جارٍ إعداد التقرير…</p>}
      {report?.groups.map(group=><div className="attendance-report-group" key={group.id}><div className="attendance-report-heading"><div><h4>{group.name}</h4><span>{group.students.length} طالب · شهر {report.month}</span></div><span className="attendance-report-total">غيابات: {group.students.reduce((a,s)=>a+s.absences,0)} · تأخيرات: {group.students.reduce((a,s)=>a+s.delays,0)}</span></div>{group.students.length?<div className="attendance-report-scroll"><table><thead><tr><th>#</th><th>اسم الطالب</th><th>غياب</th><th>تأخير</th><th>حضور</th></tr></thead><tbody>{group.students.map((s,i)=><tr key={s.id}><td>{i+1}</td><td>{s.name}</td><td className={s.absences?'attendance-number-absent':''}>{s.absences}</td><td className={s.delays?'attendance-number-late':''}>{s.delays}</td><td>{s.presents}</td></tr>)}</tbody></table></div>:<p className="quiet-empty">لا يوجد طلاب بهذه الشعبة.</p>}</div>)}{report&&!report.groups.length&&<p className="quiet-empty">لا توجد شُعب مطابقة للتقرير.</p>}<p className="scope-note">الغياب والتأخير يُحسبان بعدد السجلات المعتمدة، وليس بعدد الأيام. المسودات لا تدخل بالتقرير.</p>
    </section>}
    {!representative&&tab==='students'&&<section className="section-block attendance-panel"><div className="section-head"><div><h3>سجل الطلاب</h3><p>إجمالي غيابات وتأخيرات كل طالب في جميع السجلات المعتمدة.</p></div></div><label className="attendance-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم الطالب أو بريده"/></label>{selectedStudent?<><button className="back-button" type="button" onClick={()=>setSelectedStudent(null)}>العودة إلى سجل الطلاب</button><AttendanceHistory studentId={selectedStudent.id} onEditLesson={id=>openLesson(id).catch(()=>{})}/></>:<div className="attendance-student-list">{filteredStudents.map(s=><button type="button" key={s.id} className="attendance-student-row" onClick={()=>setSelectedStudent(s)}><strong>{s.name}</strong><span>غياب: <b className="attendance-number-absent">{s.absences}</b></span><span>تأخير: <b className="attendance-number-late">{s.delays}</b></span><PencilLine size={16}/></button>)}{!filteredStudents.length&&<p className="quiet-empty">ماكو طلاب مطابقين للبحث.</p>}</div>}</section>}
 </div>;
}
