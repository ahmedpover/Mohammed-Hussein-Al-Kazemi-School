import express from 'express';
import {forecastYear,ensureSchoolHijriYear,loadSchoolHijriYear,reflowMonths,daysBetween} from './hijri-calendar.js';
import { monthRange, validDate, validMonth, validUUID, validateLessonInput, verifyRoster } from './attendance-policy.js';

const fail=(status,message)=>Object.assign(new Error(message),{status});
const wrap=fn=>async(req,res,next)=>{try{await fn(req,res,next);}catch(error){next(error);}};
const admin=req=>{if(req.actor.role!=='admin')throw fail(403,'صلاحية الحضور والغياب مخصصة للإدارة.');};
const attendanceRecorder=req=>{if(!['admin','representative'].includes(req.actor.role))throw fail(403,'تسجيل الغياب مخصص للإدارة والممثلين.');};
const groupAccess=(req,groupId)=>{attendanceRecorder(req);if(req.actor.role==='representative'&&req.actor.groupId!==groupId)throw fail(403,'ليست لديك صلاحية تسجيل غياب شعبة أخرى.');};
const student=req=>{if(req.actor.role!=='student')throw fail(403,'سجل الطالب لصاحب الحساب فقط.');};

export async function initAttendanceTables(query){
  await query(`CREATE TABLE IF NOT EXISTS attendance_lessons(
    id uuid PRIMARY KEY,
    group_id uuid REFERENCES student_groups(id) ON DELETE SET NULL,
    group_name text NOT NULL,
    lesson_date date NOT NULL,
    period smallint NOT NULL CHECK(period BETWEEN 1 AND 32767),
    subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 100),
    finalized boolean NOT NULL DEFAULT false,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    finalized_at timestamptz,
    UNIQUE(group_id,lesson_date,period)
  );
  CREATE INDEX IF NOT EXISTS attendance_lessons_date_idx ON attendance_lessons(lesson_date,group_id);
  CREATE TABLE IF NOT EXISTS attendance_entries(
    lesson_id uuid NOT NULL REFERENCES attendance_lessons(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_name text NOT NULL,
    status text NOT NULL CHECK(status IN ('present','absent','late')),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(lesson_id,student_id)
  );
  ALTER TABLE attendance_entries ADD COLUMN IF NOT EXISTS excused boolean NOT NULL DEFAULT false;
  ALTER TABLE attendance_entries ADD COLUMN IF NOT EXISTS excused_by uuid REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE attendance_entries ADD COLUMN IF NOT EXISTS excused_at timestamptz;
  CREATE TABLE IF NOT EXISTS attendance_hijri_months(
    hijri_year integer NOT NULL CHECK(hijri_year BETWEEN 1300 AND 1600),
    hijri_month integer NOT NULL CHECK(hijri_month BETWEEN 1 AND 12),
    start_date date NOT NULL,
    end_date date NOT NULL,
    source_url text,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(hijri_year,hijri_month),
    CONSTRAINT hijri_month_duration CHECK(end_date-start_date IN (28,29))
  );
  ALTER TABLE attendance_hijri_months ADD COLUMN IF NOT EXISTS confirmed boolean NOT NULL DEFAULT false;
  CREATE INDEX IF NOT EXISTS attendance_entries_student_idx ON attendance_entries(student_id);
  CREATE TABLE IF NOT EXISTS attendance_audit(
    id uuid PRIMARY KEY,
    lesson_id uuid NOT NULL REFERENCES attendance_lessons(id) ON DELETE CASCADE,
    student_id uuid REFERENCES users(id) ON DELETE SET NULL,
    old_status text,
    new_status text NOT NULL,
    changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    changed_at timestamptz NOT NULL DEFAULT now()
  );`);
}

function safeMonth(queryMonth){return monthRange(queryMonth);}
function lessonFields(){return `l.id,l.group_id AS "groupId",l.group_name AS "groupName",l.lesson_date::text AS "lessonDate",l.period,l.subject,l.finalized,l.created_at AS "createdAt",l.updated_at AS "updatedAt"`;}

const countsSql = `COUNT(*) FILTER(WHERE e.status='absent' AND NOT e.excused)::int AS absences,
  COUNT(*) FILTER(WHERE e.status='late')::int AS delays,
  COUNT(*) FILTER(WHERE e.status='present')::int AS presents, COUNT(*) FILTER(WHERE e.status='absent' AND e.excused)::int AS excused`;

export function createAttendanceRouter({query,pool,id}){
 const router=express.Router();
 router.get('/hijri-months',wrap(async(req,res)=>{
   admin(req);
   const year=Number(req.query.year||new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{year:'numeric'}).format(new Date()));
   if(!Number.isInteger(year)||year<1300||year>1600)throw fail(400,'السنة الهجرية غير صحيحة.');
   res.json(await loadSchoolHijriYear(query,year));
 }));
 // The student's view uses the SAME global calendar, but cannot edit it.
 router.get('/hijri-calendar',wrap(async(req,res)=>{
   if(!req.actor?.id)throw fail(401,'يجب تسجيل الدخول.');
   const year=Number(req.query.year);
   if(!Number.isInteger(year)||year<1300||year>1600)throw fail(400,'السنة الهجرية غير صحيحة.');
   res.json(await loadSchoolHijriYear(query,year));
 }));
 router.put('/hijri-months',wrap(async(req,res)=>{
   admin(req);
   const {year,month,days,startDate,sourceUrl=''}=req.body||{};
   const y=Number(year),m=Number(month),d=Number(days);
   if(!Number.isInteger(y)||y<1300||y>1600||!Number.isInteger(m)||m<1||m>12||![29,30].includes(d))throw fail(400,'اختر السنة والشهر وعدد الأيام (29 أو 30).');
   if(startDate!==undefined&&!validDate(startDate))throw fail(400,'تاريخ البداية غير صحيح.');
   const url=String(sourceUrl||'').trim();
   if(url.length>500)throw fail(400,'رابط المصدر طويل جداً.');
   const client=await pool.connect();
   try{
     await client.query('BEGIN');
     await client.query('LOCK TABLE attendance_hijri_months IN EXCLUSIVE MODE');
     await ensureSchoolHijriYear(client,y);
     const {rows}=await client.query(`SELECT hijri_year AS year,hijri_month AS month,start_date::text AS "startDate",end_date::text AS "endDate",source_url AS "sourceUrl",confirmed FROM attendance_hijri_months ORDER BY start_date, hijri_year, hijri_month FOR UPDATE`);
     const idx=rows.findIndex(r=>Number(r.year)===y&&Number(r.month)===m);
     if(idx<0)throw fail(500,'تعذّر العثور على الشهر.');
     const sequence=rows.map(r=>({...r,days:daysBetween(r.startDate,r.endDate)}));
     const targetStart=startDate||sequence[idx].startDate;
     let result;
     try{result=reflowMonths(sequence,idx,d,targetStart);}catch(e){throw fail(400,e.message);}
     result[idx].confirmed=true;
     result[idx].sourceUrl=url;
     const from=idx>0&&result[idx-1].endDate!==sequence[idx-1].endDate?idx-1:idx;
     for(let i=from;i<result.length;i++){
       const item=result[i];
       await client.query(`UPDATE attendance_hijri_months SET start_date=$3::date,end_date=$4::date,source_url=$5,confirmed=$6,updated_by=$7,updated_at=now() WHERE hijri_year=$1 AND hijri_month=$2`,[item.year,item.month,item.startDate,item.endDate,item.sourceUrl,item.confirmed,req.actor.id]);
     }
     await client.query('COMMIT');
     res.json({ok:true,year:y,month:m});
   }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }));
 router.patch('/students/:studentId/lessons/:lessonId/excuse',wrap(async(req,res)=>{
   admin(req);
   const {studentId,lessonId}=req.params;
   if(!validUUID(studentId)||!validUUID(lessonId)||typeof req.body?.excused!=='boolean')throw fail(400,'طلب غير صحيح.');
   const {rows}=await query(`UPDATE attendance_entries e SET excused=$3,excused_by=$4,excused_at=CASE WHEN $3 THEN now() ELSE NULL END,updated_at=now()
     FROM attendance_lessons l WHERE e.lesson_id=l.id AND e.student_id=$1 AND e.lesson_id=$2 AND e.status='absent' AND l.finalized=true RETURNING e.student_id`,[studentId,lessonId,req.body.excused,req.actor.id]);
   if(!rows.length)throw fail(404,'الغياب غير موجود أو غير معتمد.');
   res.json({ok:true});
 }));
 router.get('/groups',wrap(async(req,res)=>{
   attendanceRecorder(req);
   const {rows}=await query(`SELECT g.id,g.name,COUNT(gm.student_id)::int AS "studentCount" FROM student_groups g LEFT JOIN student_group_members gm ON gm.group_id=g.id WHERE ($1::uuid IS NULL OR g.id=$1::uuid) GROUP BY g.id ORDER BY g.name`,[req.actor.role==='representative'?req.actor.groupId:null]);
   res.json(rows);
 }));
 router.get('/groups/:groupId/roster',wrap(async(req,res)=>{
   groupAccess(req,req.params.groupId);
   const {rows:groups}=await query('SELECT id,name FROM student_groups WHERE id=$1',[req.params.groupId]);
   if(!groups.length)throw fail(404,'الشعبة غير موجودة.');
   const {rows}=await query(`SELECT u.id,u.name FROM student_group_members gm JOIN users u ON u.id=gm.student_id WHERE gm.group_id=$1 AND u.role='student' ORDER BY u.name,u.id`,[req.params.groupId]);
   res.json({group:groups[0],students:rows});
 }));
 router.get('/lessons',wrap(async(req,res)=>{
   groupAccess(req,req.query.groupId);
   const groupId=req.query.groupId;
   const date=req.query.date;
   if(!validUUID(groupId) || !validDate(date))throw fail(400,'اختر شعبة وتاريخاً صحيحين.');
   const {rows}=await query(`SELECT ${lessonFields()},COUNT(e.student_id)::int AS "studentCount",COUNT(*) FILTER(WHERE e.status='absent' AND NOT e.excused)::int AS absences,COUNT(*) FILTER(WHERE e.status='late')::int AS delays FROM attendance_lessons l LEFT JOIN attendance_entries e ON e.lesson_id=l.id WHERE l.group_id=$1 AND l.lesson_date=$2::date GROUP BY l.id ORDER BY l.period,l.subject`,[groupId,date]);
   res.json(rows);
 }));
 router.get('/lessons/:lessonId',wrap(async(req,res)=>{
   attendanceRecorder(req);
   if(req.actor.role==='representative'){const {rows}=await query('SELECT group_id FROM attendance_lessons WHERE id=$1',[req.params.lessonId]);if(!rows.length)throw fail(404,'السجل غير موجود.');groupAccess(req,rows[0].group_id);}
   const {rows}=await query(`SELECT ${lessonFields()} FROM attendance_lessons l WHERE l.id=$1`,[req.params.lessonId]);
   if(!rows.length)throw fail(404,'السجل غير موجود.');
   const {rows:students}=await query(`SELECT e.student_id AS id,COALESCE(u.name,e.student_name) AS name,e.status FROM attendance_entries e LEFT JOIN users u ON u.id=e.student_id WHERE e.lesson_id=$1 ORDER BY name,e.student_id`,[req.params.lessonId]);
   res.json({lesson:rows[0],students});
 }));
 router.post('/lessons',wrap(async(req,res)=>{
   attendanceRecorder(req);
   const input=validateLessonInput(req.body);
   groupAccess(req,input.groupId);
   const client=await pool.connect();
   try {
     await client.query('BEGIN');
     const {rows:groups}=await client.query('SELECT id,name FROM student_groups WHERE id=$1 FOR SHARE',[input.groupId]);
     if(!groups.length)throw fail(404,'الشعبة غير موجودة.');
     let lessonId=input.lessonId||null;
     let lessonPeriod=1;
     let roster;
     if(lessonId){
       const {rows:currentRows}=await client.query('SELECT id,period,group_id,finalized FROM attendance_lessons WHERE id=$1 FOR UPDATE',[lessonId]);
       if(!currentRows.length)throw fail(409,'السجل الذي تحاول تعديله لم يعد موجوداً؛ أعد تحميل القائمة.');
       if(req.actor.role==='representative'&&currentRows[0].finalized)throw fail(403,'تصحيح السجل المعتمد من صلاحية الإدارة فقط.');
       if(req.actor.role==='representative'){const {rows:linked}=await client.query('SELECT group_id FROM attendance_lessons WHERE id=$1',[lessonId]);if(linked[0]?.group_id!==input.groupId)throw fail(403,'السجل تابع لشعبة أخرى.');}
       lessonPeriod=currentRows[0].period || 1;
       const {rows:dup}=await client.query(`SELECT id FROM attendance_lessons WHERE group_id=$1 AND lesson_date=$2::date AND LOWER(BTRIM(subject))=LOWER(BTRIM($3)) AND id<>$4 FOR UPDATE`,[input.groupId,input.lessonDate,input.subject,lessonId]);
       if(dup.length)throw fail(409,'هذه المادة مسجلة مسبقاً في هذا اليوم. افتح سجلها من قائمة مواد اليوم لتعديله.');
       const {rows}=await client.query('SELECT student_id AS id,student_name AS name,status FROM attendance_entries WHERE lesson_id=$1 ORDER BY student_name,student_id',[lessonId]);
       roster=rows;
     } else {
       const {rows:sameDay}=await client.query('SELECT id,period,subject FROM attendance_lessons WHERE group_id=$1 AND lesson_date=$2::date ORDER BY period FOR UPDATE',[input.groupId,input.lessonDate]);
       const duplicate=sameDay.find(item=>String(item.subject||'').trim().toLowerCase()===input.subject.trim().toLowerCase());
       if(duplicate)throw fail(409,'هذه المادة مسجلة مسبقاً في هذا اليوم. افتح سجلها من قائمة مواد اليوم لتعديله.');
       lessonPeriod=(sameDay.at(-1)?.period || 0) + 1;
       lessonId=id();
       const {rows}=await client.query(`SELECT u.id,u.name FROM student_group_members gm JOIN users u ON u.id=gm.student_id WHERE gm.group_id=$1 AND u.role='student' ORDER BY u.name,u.id`,[input.groupId]);
       roster=rows;
     }
     verifyRoster(roster.map(item=>item.id),input.entries);
     if(!input.lessonId){
       await client.query(`INSERT INTO attendance_lessons(id,group_id,group_name,lesson_date,period,subject,finalized,created_by,updated_by,finalized_at) VALUES($1,$2,$3,$4::date,$5,$6,$7,$8,$8,CASE WHEN $7 THEN now() ELSE NULL END)`,[lessonId,input.groupId,groups[0].name,input.lessonDate,lessonPeriod,input.subject,input.finalize,req.actor.id]);
     } else {
       await client.query(`UPDATE attendance_lessons SET subject=$1,group_name=$2,finalized=finalized OR $3,updated_by=$4,updated_at=now(),finalized_at=CASE WHEN $3 AND finalized_at IS NULL THEN now() ELSE finalized_at END WHERE id=$5`,[input.subject,groups[0].name,input.finalize,req.actor.id,lessonId]);
     }
     const previous=new Map(roster.map(item=>[item.id,item.status]));
     const names=new Map(roster.map(item=>[item.id,item.name]));
     for(const entry of input.entries){
       const prior=previous.get(entry.studentId)||null;
       if(prior===entry.status)continue;
       await client.query(`INSERT INTO attendance_entries(lesson_id,student_id,student_name,status,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(lesson_id,student_id) DO UPDATE SET status=EXCLUDED.status,excused=CASE WHEN attendance_entries.status=EXCLUDED.status THEN attendance_entries.excused ELSE false END,updated_by=EXCLUDED.updated_by,updated_at=now()`,[lessonId,entry.studentId,names.get(entry.studentId),entry.status,req.actor.id]);
       await client.query(`INSERT INTO attendance_audit(id,lesson_id,student_id,old_status,new_status,changed_by) VALUES($1,$2,$3,$4,$5,$6)`,[id(),lessonId,entry.studentId,prior,entry.status,req.actor.id]);
     }
     await client.query('COMMIT');
     res.status(input.lessonId?200:201).json({id:lessonId,finalized:input.finalize,ok:true});
   }catch(error){await client.query('ROLLBACK');if(error.code==='23505')throw fail(409,'هذه المادة تم حفظها من حساب آخر. حدّث القائمة وافتح السجل الموجود.');throw error;}finally{client.release();}
 }));
 router.get('/report',wrap(async(req,res)=>{
   admin(req);
   let first,last;
   if(req.query.hijriYear && req.query.hijriMonth){
     const y=Number(req.query.hijriYear),m=Number(req.query.hijriMonth);
     if(!Number.isInteger(y)||!Number.isInteger(m)||m<1||m>12)throw fail(400,'الشهر الهجري غير صحيح.');
     const calendar=await loadSchoolHijriYear(query,y);
     first=calendar[m-1].startDate;last=calendar[m-1].endDate;
   }else{first=safeMonth(req.query.month);const d=new Date(first+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(d.getUTCDate()-1);last=d.toISOString().slice(0,10);}
   const groupId=req.query.groupId||null;
   if(groupId && !validUUID(groupId))throw fail(400,'الشعبة غير صحيحة.');
   const {rows}=await query(`WITH pupils AS (
     SELECT group_id,student_id FROM student_group_members
     UNION
     SELECT l.group_id,e.student_id FROM attendance_lessons l JOIN attendance_entries e ON e.lesson_id=l.id
       WHERE l.finalized=true AND l.lesson_date >= $1::date AND l.lesson_date <= $3::date AND l.group_id IS NOT NULL
   ), stats AS (
     SELECT l.group_id,e.student_id,
     COUNT(*) FILTER(WHERE e.status='absent' AND NOT e.excused)::int AS absences,
     COUNT(*) FILTER(WHERE e.status='late')::int AS delays,
     COUNT(*) FILTER(WHERE e.status='present')::int AS presents, COUNT(*) FILTER(WHERE e.status='absent' AND e.excused)::int AS excused
     FROM attendance_entries e JOIN attendance_lessons l ON l.id=e.lesson_id
     WHERE l.finalized=true AND l.lesson_date >= $1::date AND l.lesson_date <= $3::date
     GROUP BY l.group_id,e.student_id
   )
   SELECT g.id AS "groupId",g.name AS "groupName",u.id AS "studentId",u.name AS "studentName",
     COALESCE(s.absences,0)::int AS absences,COALESCE(s.delays,0)::int AS delays,COALESCE(s.presents,0)::int AS presents,COALESCE(s.excused,0)::int AS excused
   FROM student_groups g LEFT JOIN pupils p ON p.group_id=g.id
   LEFT JOIN users u ON u.id=p.student_id AND u.role='student'
   LEFT JOIN stats s ON s.group_id=g.id AND s.student_id=u.id
   WHERE ($2::uuid IS NULL OR g.id=$2::uuid)
   ORDER BY g.name,u.name,u.id`,[first,groupId,last]);
   const groups=[];
   for(const row of rows){
     let group=groups.find(item=>item.id===row.groupId);
     if(!group){group={id:row.groupId,name:row.groupName,students:[]};groups.push(group);}
     if(row.studentId)group.students.push({id:row.studentId,name:row.studentName,absences:row.absences,delays:row.delays,presents:row.presents,excused:row.excused});
   }
   res.json({month:req.query.hijriYear?`${req.query.hijriYear}-${String(req.query.hijriMonth).padStart(2,'0')}-H`:req.query.month,groups});
 }));
 router.get('/students',wrap(async(req,res)=>{
   admin(req);
   const {rows}=await query(`SELECT u.id,u.name,u.email,COUNT(*) FILTER(WHERE l.finalized AND e.status='absent' AND NOT e.excused)::int AS absences,COUNT(*) FILTER(WHERE l.finalized AND e.status='late')::int AS delays
     FROM users u LEFT JOIN attendance_entries e ON e.student_id=u.id LEFT JOIN attendance_lessons l ON l.id=e.lesson_id WHERE u.role='student' GROUP BY u.id ORDER BY u.name`);
   res.json(rows);
 }));
 async function studentHistory(studentId){
   const {rows:totals}=await query(`SELECT ${countsSql} FROM attendance_entries e JOIN attendance_lessons l ON l.id=e.lesson_id WHERE e.student_id=$1 AND l.finalized=true`,[studentId]);
   const {rows:items}=await query(`SELECT l.id AS "lessonId",l.group_name AS "groupName",l.lesson_date::text AS "lessonDate",l.subject,l.period,e.status,e.excused
     FROM attendance_entries e JOIN attendance_lessons l ON l.id=e.lesson_id
     WHERE e.student_id=$1 AND l.finalized=true AND e.status IN ('absent','late') ORDER BY l.lesson_date DESC,l.period DESC LIMIT 1000`,[studentId]);
   return {totals:totals[0]||{absences:0,delays:0,presents:0},items};
 }
 router.get('/students/:studentId',wrap(async(req,res)=>{
   admin(req);
   const {rows}=await query(`SELECT id,name FROM users WHERE id=$1 AND role='student'`,[req.params.studentId]);
   if(!rows.length)throw fail(404,'الطالب غير موجود.');
   res.json({...rows[0],...await studentHistory(req.params.studentId)});
 }));
 router.get('/me',wrap(async(req,res)=>{
   student(req);
   res.json(await studentHistory(req.actor.id));
 }));
 return router;
}
