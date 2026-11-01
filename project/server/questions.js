/**
 * Questions & answers. Unanswered questions are never publicly listed.
 * A public answer publishes the question body but never the student's identity.
 * Private replies are accessible only to their author, the asking student and admins.
 */
import { Router } from 'express';
import multer from 'multer';
import { sendMedia } from './media-response.js';
import { canReadQuestion, canAnswerQuestion, canReadAnswer } from './question-policy.js';

const TOPICS = ['الفقه','الأصول','النحو','المنطق','العقائد','اللغة العربية','أخرى'];
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_AUDIO = 12 * 1024 * 1024;
const AUDIO_TYPES = new Set(['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav','audio/x-wav','audio/vnd.wave','audio/aac','audio/x-m4a']);
const IMAGE_TYPES = new Set(['image/jpeg','image/png','image/webp']);
const trim = value => typeof value === 'string' ? value.trim() : '';
const isUUID = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const mime = file => file?.mimetype?.split(';')[0].toLowerCase() || '';
const wrapped = fn => (req,res,next) => Promise.resolve().then(() => fn(req,res)).catch(next);

function validImage(file) {
  const b=file.buffer, t=mime(file);
  if (!IMAGE_TYPES.has(t) || file.size > MAX_IMAGE) return false;
  if (t==='image/png') return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (t==='image/jpeg') return b[0]===255 && b[1]===216 && b[2]===255;
  return b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP';
}
function validAudio(file) {
  if (!AUDIO_TYPES.has(mime(file)) || !file.size || file.size > MAX_AUDIO) return false;
  const b=file.buffer, t=mime(file);
  if (t==='audio/webm') return b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  if (t==='audio/ogg') return b.toString('ascii',0,4)==='OggS';
  if (t==='audio/mp4' || t==='audio/x-m4a') return b.toString('ascii',4,8)==='ftyp';
  if (t==='audio/wav' || t==='audio/x-wav' || t==='audio/vnd.wave') return b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WAVE';
  if (t==='audio/mpeg') return b.toString('ascii',0,3)==='ID3' || (b[0]===255 && (b[1]&224)===224);
  return true; // AAC may have ADTS headers or MP4 container variations.
}

export async function initQuestionTables(query) {
  await query(`CREATE TABLE IF NOT EXISTS questions (
    id uuid PRIMARY KEY,
    student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
    audience text NOT NULL CHECK(audience IN ('all','teacher')),
    topic text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS questions_student_idx ON questions(student_id,created_at DESC);
  CREATE INDEX IF NOT EXISTS questions_teacher_idx ON questions(teacher_id,created_at DESC);
  CREATE TABLE IF NOT EXISTS question_answers (
    id uuid PRIMARY KEY,
    question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    author_id uuid REFERENCES users(id) ON DELETE SET NULL,
    author_name text NOT NULL,
    visibility text NOT NULL CHECK (visibility IN ('private','public')),
    body text NOT NULL DEFAULT '',
    image bytea, image_type text,
    audio bytea, audio_type text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS question_answers_question_idx ON question_answers(question_id,created_at ASC);
  CREATE INDEX IF NOT EXISTS question_answers_public_idx ON question_answers(question_id) WHERE visibility='public';`);
}

const QUESTION_SQL = `SELECT q.id,q.topic,q.title,q.body,q.audience,q.student_id AS "studentId",s.name AS "studentName",q.teacher_id AS "teacherId",
  t.name AS "teacherName",q.created_at AS "createdAt",
  (SELECT count(*)::int FROM question_answers ac WHERE ac.question_id=q.id) AS "totalAnswers",
  (SELECT count(*)::int FROM question_answers ap WHERE ap.question_id=q.id AND ap.visibility='public') AS "publicAnswers",
  EXISTS(SELECT 1 FROM question_answers a WHERE a.question_id=q.id AND a.visibility='public') AS published
  FROM questions q LEFT JOIN users t ON t.id=q.teacher_id LEFT JOIN users s ON s.id=q.student_id`;

export function createQuestionsRouter({query,id,requireUser,fail,pushStudent}) {
  const router=Router();
  router.use(requireUser);
  const upload=multer({storage:multer.memoryStorage(),limits:{files:2,fileSize:MAX_AUDIO,fields:4,fieldSize:9000}});
  async function getQuestion(questionId) {
    if (!isUUID(questionId)) throw fail(404,'السؤال غير موجود.');
    const {rows}=await query(`${QUESTION_SQL} WHERE q.id=$1`,[questionId]);
    if (!rows.length) throw fail(404,'السؤال غير موجود.');
    return rows[0];
  }
  async function readable(req,id) {
    const q=await getQuestion(id);
    if (!canReadQuestion(req.actor.role,req.actor.id,q)) throw fail(403,'هذا السؤال غير متاح لحسابك.');
    return q;
  }
  function publicQuestion(q,req) {
    const {studentId,studentName,totalAnswers, ...rest}=q;
    return {...rest,answerCount:req.actor.role==='admin'||studentId===req.actor.id?totalAnswers:q.publicAnswers,isMine:studentId===req.actor.id,
      ...(req.actor.role==='admin'?{studentId,studentName}:q.studentId===req.actor.id?{studentName}:{}),
      canAnswer:canAnswerQuestion(req.actor.role,req.actor.id,q)};
  }

  router.get('/teachers',wrapped(async(req,res)=>{
    if(req.actor.role!=='student') throw fail(403,'هذه القائمة مخصصة للطلاب.');
    const {rows}=await query(`SELECT DISTINCT u.id,i.name FROM memberships m
      JOIN channels c ON c.id=m.channel_id
      JOIN users u ON u.id=c.owner_id
      JOIN invites i ON i.email=u.email
      WHERE m.user_id=$1 AND u.role='teacher' AND i.active=true
      ORDER BY i.name`,[req.actor.id]);
    res.json(rows);
  }));

  router.get('/',wrapped(async(req,res)=>{
    const {rows}=await query(`${QUESTION_SQL}
      WHERE q.student_id=$1 OR $2::text='admin'
        OR ($2::text='teacher' AND (q.audience='all' OR q.teacher_id=$1))
        OR EXISTS(SELECT 1 FROM question_answers a WHERE a.question_id=q.id AND a.visibility='public')
      ORDER BY q.created_at DESC LIMIT 200`,[req.actor.id,req.actor.role]);
    res.json(rows.map(q=>publicQuestion(q,req)));
  }));

  router.post('/',wrapped(async(req,res)=>{
    if(req.actor.role!=='student') throw fail(403,'إرسال الأسئلة متاح للطلاب فقط.');
    const {topic,title,body}=req.body||{};
    const teacherId=req.body?.teacherId ?? null;
    if (!TOPICS.includes(topic) || !trim(title) || trim(title).length>120 || !trim(body) || trim(body).length>5000)
      throw fail(400,'حدد الموضوع واكتب عنوانًا وسؤالًا لا يتجاوز ٥٠٠٠ حرف.');
    if (teacherId!==null) {
      if(!isUUID(teacherId)) throw fail(400,'اختر أستاذًا من القائمة.');
      const {rowCount}=await query(`SELECT 1 FROM memberships m
        JOIN channels c ON c.id=m.channel_id
        JOIN users u ON u.id=c.owner_id
        JOIN invites i ON i.email=u.email
        WHERE m.user_id=$1 AND u.id=$2 AND u.role='teacher' AND i.active=true`,
        [req.actor.id,teacherId]);
      if(!rowCount)throw fail(400,'تستطيع إرسال سؤال خاص فقط لأساتذة القنوات التي انضممت إليها.');
    }
    const questionId=id();
    await query('INSERT INTO questions(id,student_id,teacher_id,audience,topic,title,body) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [questionId,req.actor.id,teacherId,teacherId===null?'all':'teacher',topic,trim(title),trim(body)]);
    res.status(201).json({id:questionId});
  }));

  router.get('/:id',wrapped(async(req,res)=>{
    const q=await readable(req,req.params.id);
    res.json(publicQuestion(q,req));
  }));

  router.get('/:id/answers',wrapped(async(req,res)=>{
    const q=await readable(req,req.params.id);
    const {rows}=await query(`SELECT a.id,a.question_id AS "questionId",a.author_id AS "authorId",a.author_name AS "authorName",
      a.visibility,a.body,a.created_at AS "createdAt",(a.image IS NOT NULL) AS "hasImage",(a.audio IS NOT NULL) AS "hasAudio"
      FROM question_answers a WHERE a.question_id=$1 ORDER BY a.created_at,a.id`,[q.id]);
    res.json(rows.filter(a=>canReadAnswer(req.actor.role,req.actor.id,q,a)).map(a=>({
      ...a,authorId:undefined,
      imageUrl:a.hasImage?`/api/questions/answers/${a.id}/media/image`:null,
      audioUrl:a.hasAudio?`/api/questions/answers/${a.id}/media/audio`:null
    })));
  }));

  router.post('/:id/answers',upload.fields([{name:'image',maxCount:1},{name:'audio',maxCount:1}]),wrapped(async(req,res)=>{
    const q=await getQuestion(req.params.id);
    if (!canAnswerQuestion(req.actor.role,req.actor.id,q))
      throw fail(403,'لا تملك صلاحية الإجابة على هذا السؤال.');
    const body=trim(req.body?.body),visibility=req.body?.visibility;
    const image=req.files?.image?.[0],audio=req.files?.audio?.[0];
    if (!['private','public'].includes(visibility))throw fail(400,'اختر خصوصية الإجابة.');
    if (body.length>8000 || (!body&&!image&&!audio))throw fail(400,'اكتب الإجابة أو أرفق صورة أو بصمة صوتية.');
    if (image && !validImage(image))throw fail(400,'الصورة غير صالحة؛ المسموح JPG أو PNG أو WebP بحد ٥ ميغابايت.');
    if (audio && !validAudio(audio))throw fail(400,'البصمة غير صالحة أو حجمها أكثر من ١٢ ميغابايت.');
    const answerId=id();
    await query(`INSERT INTO question_answers(id,question_id,author_id,author_name,visibility,body,image,image_type,audio,audio_type)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [answerId,q.id,req.actor.id,req.actor.name,visibility,body,image?.buffer||null,image?mime(image):null,audio?.buffer||null,audio?mime(audio):null]);
    try {
      const message=visibility==='public'?'نُشرت إجابة عامة على سؤالك':'وصلتك إجابة خاصة على سؤالك';
      await query(`INSERT INTO notifications(id,student_id,sender_id,message) VALUES($1,$2,$3,$4)`,
        [id(),q.studentId,req.actor.id,`${message}: ${q.title}`.slice(0,500)]);
      pushStudent(q.studentId,{title:'إجابة جديدة عن سؤالك',body:q.title,url:'/?page=questions'});
    }catch(err){console.warn('Question notification failed:',err.message);}
    res.status(201).json({id:answerId,visibility});
  }));

  router.get('/answers/:answerId/media/:kind',wrapped(async(req,res)=>{
    if(!isUUID(req.params.answerId)||!['image','audio'].includes(req.params.kind))throw fail(404,'الملف غير موجود.');
    const {rows}=await query(`SELECT a.id,a.question_id,a.author_id AS "authorId",a.visibility,
      q.student_id AS "studentId",q.teacher_id AS "teacherId",q.audience,
      EXISTS(SELECT 1 FROM question_answers p WHERE p.question_id=q.id AND p.visibility='public') AS published,
      a.image,a.image_type,a.audio,a.audio_type
      FROM question_answers a JOIN questions q ON q.id=a.question_id WHERE a.id=$1`,[req.params.answerId]);
    const a=rows[0];
    if(!a || !canReadQuestion(req.actor.role,req.actor.id,a) || !canReadAnswer(req.actor.role,req.actor.id,a,a))
      throw fail(404,'الملف غير موجود.');
    const kind=req.params.kind;
    const contents=a[kind],type=a[`${kind}_type`];
    if(!contents||!type)throw fail(404,'الملف غير موجود.');
    res.set('Cache-Control','private, no-store');
    res.set('Content-Disposition',`inline; filename="question-${a.id}.${kind==='image'?(type==='image/png'?'png':type==='image/webp'?'webp':'jpg'):'audio'}"`);
    res.type(type);
    sendMedia(req,res,contents);
  }));
  return router;
}
