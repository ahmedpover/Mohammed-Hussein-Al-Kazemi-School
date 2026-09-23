import express from 'express';
import pg from 'pg';
import multer from 'multer';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, randomUUID, scrypt as rawScrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scrypt = promisify(rawScrypt);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
const app = express();
app.disable('x-powered-by');
// Railway terminates HTTPS at its proxy and forwards the original scheme.
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '32kb' }));
const id = () => randomUUID();
const fail = (status, message) => Object.assign(new Error(message), { status });
const emailKey = value => String(value || '').trim().toLowerCase();
const clean = (value, max) => String(value || '').trim().slice(0, max + 1);
const valid = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const hash = async password => { const salt = randomBytes(16).toString('hex'); return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`; };
const verify = async (password, stored) => { const [salt, digest] = stored.split(':'); const actual = await scrypt(password, salt, 64); const expected = Buffer.from(digest, 'hex'); return actual.length === expected.length && timingSafeEqual(actual, expected); };
const digestToken = token => createHash('sha256').update(token).digest('hex');
const query = (sql, args=[]) => pool.query(sql,args);
const wrap = handler => async (req,res,next) => { try { await handler(req,res,next); } catch (error) { next(error); } };
const authLimit = rateLimit({ windowMs: 15*60*1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/api/auth/login', authLimit);
app.use('/api/auth/register', authLimit);
app.use('/api/auth', (req,res,next) => { if (req.method !== 'GET') { const origin=req.get('origin'); if (origin && origin !== `${req.protocol}://${req.get('host')}` && origin !== process.env.PUBLIC_ORIGIN) return next(fail(403,'مصدر الطلب غير مسموح.')); } next(); });
app.use('/api', (req,res,next) => { if (req.method !== 'GET' && req.method !== 'HEAD') { const origin=req.get('origin'); if (origin && origin !== `${req.protocol}://${req.get('host')}` && origin !== process.env.PUBLIC_ORIGIN) return next(fail(403,'مصدر الطلب غير مسموح.')); } next(); });
function cookie(req) { return String(req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith('school_session='))?.slice(15); }
async function actor(req) { const token=cookie(req); if (!token) return null; const {rows}=await query(`SELECT u.id,u.email,u.name,u.role,i.name AS invited_name,i.subjects,i.active FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN invites i ON i.email=u.email WHERE s.token_hash=$1 AND s.expires_at>now()`,[digestToken(token)]); const user=rows[0]; if(!user) return null; if(user.role==='admin') return { ...user, role:'admin', subjects:[] }; if(user.role==='teacher' && user.invited_name && user.active) return {...user,role:'teacher',name:user.invited_name,subjects:user.subjects}; return {...user,role:'student',subjects:[]}; }
const requireUser = wrap(async (req,res,next) => { req.actor=await actor(req); if(!req.actor) throw fail(401,'سجّل الدخول أولاً.'); next(); });
const admin = req => { if(req.actor.role!=='admin') throw fail(403,'هذه العملية للمدير فقط.'); };
const teaches = (req,subject) => { if(req.actor.role!=='teacher' || !req.actor.subjects.includes(subject)) throw fail(403,'هذه المادة غير معتمدة لحسابك.'); };
async function owner(req,table,resource) { const {rows}=await query(`SELECT * FROM ${table} WHERE id=$1`,[resource]); const item=rows[0]; if(!item) throw fail(404,'العنصر غير موجود.'); if(req.actor.role!=='admin') { if(item.owner_id!==req.actor.id) throw fail(403,'ليست لديك صلاحية على هذا العنصر.'); teaches(req,item.subject); } return item; }
async function session(res,userId) { const token=randomBytes(32).toString('hex'); await query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'30 days\')',[digestToken(token),userId]); res.cookie('school_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:30*86400000}); }
async function init() {
 if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
 await query(`CREATE TABLE IF NOT EXISTS users(id uuid PRIMARY KEY,email text UNIQUE NOT NULL,name text NOT NULL,password_hash text NOT NULL,role text NOT NULL DEFAULT 'student',created_at timestamptz DEFAULT now());
 CREATE TABLE IF NOT EXISTS sessions(token_hash text PRIMARY KEY,user_id uuid REFERENCES users(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL);
 CREATE TABLE IF NOT EXISTS invites(email text PRIMARY KEY,name text NOT NULL,subjects jsonb NOT NULL,active boolean NOT NULL DEFAULT true,code_hash text);
 CREATE TABLE IF NOT EXISTS channels(id uuid PRIMARY KEY,handle text UNIQUE NOT NULL,name text NOT NULL,subject text NOT NULL,book text NOT NULL,description text NOT NULL DEFAULT '',owner_id uuid REFERENCES users(id),teacher_name text NOT NULL,created_at timestamptz DEFAULT now());
 CREATE TABLE IF NOT EXISTS memberships(user_id uuid REFERENCES users(id) ON DELETE CASCADE,channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,PRIMARY KEY(user_id,channel_id));
 CREATE TABLE IF NOT EXISTS posts(id uuid PRIMARY KEY,channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,owner_id uuid REFERENCES users(id),text text NOT NULL DEFAULT '',image bytea,image_type text,created_at timestamptz DEFAULT now());
 CREATE TABLE IF NOT EXISTS lectures(id uuid PRIMARY KEY,title text NOT NULL,subject text NOT NULL,book text NOT NULL,description text NOT NULL DEFAULT '',owner_id uuid REFERENCES users(id),teacher_name text NOT NULL,created_at timestamptz DEFAULT now());
 CREATE TABLE IF NOT EXISTS media(id uuid PRIMARY KEY,lecture_id uuid REFERENCES lectures(id) ON DELETE CASCADE,kind text NOT NULL,mime text NOT NULL,content bytea NOT NULL,UNIQUE(lecture_id,kind)); ALTER TABLE invites ADD COLUMN IF NOT EXISTS code_hash text;`);
 await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS course_number text;
 CREATE TABLE IF NOT EXISTS notifications(id uuid PRIMARY KEY,student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,sender_id uuid REFERENCES users(id) ON DELETE SET NULL,message text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz);`);
 if(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const email=emailKey(process.env.ADMIN_EMAIL);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || process.env.ADMIN_PASSWORD.length<12) throw new Error('ADMIN_EMAIL or ADMIN_PASSWORD invalid');
  const {rows}=await query('SELECT id,role,password_hash FROM users WHERE email=$1',[email]);
  if(rows.length && rows[0].role!=='admin') throw new Error('Admin email already belongs to a non-admin account');
  if(!rows.length) {
   await query('INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5)',[id(),email,process.env.ADMIN_NAME || 'إدارة المدرسة',await hash(process.env.ADMIN_PASSWORD),'admin']);
   console.log('Initial administrator created');
  } else if(!(await verify(process.env.ADMIN_PASSWORD,rows[0].password_hash))) {
   await query('UPDATE users SET password_hash=$1 WHERE id=$2',[await hash(process.env.ADMIN_PASSWORD),rows[0].id]);
   await query('DELETE FROM sessions WHERE user_id=$1',[rows[0].id]);
   console.log('Administrator password synchronized with Railway variable');
  }
 }
}
app.get('/api/health',(_req,res)=>res.json({ok:true}));
app.post('/api/auth/register',wrap(async(req,res)=>{ const email=emailKey(req.body.email), name=clean(req.body.name,70), password=req.body.password, inviteCode=String(req.body.inviteCode||'').trim(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!valid(name,70)||typeof password!=='string'||password.length<10||password.length>128) throw fail(400,'تحقق من البريد والاسم وكلمة مرور لا تقل عن ١٠ أحرف.'); try { let role='student'; if(inviteCode){const {rows}=await query('SELECT code_hash,active FROM invites WHERE email=$1',[email]);if(!rows[0]?.active||!rows[0].code_hash||digestToken(inviteCode)!==rows[0].code_hash)throw fail(403,'رمز دعوة الأستاذ غير صحيح.');role='teacher';} const userId=id(); await query('INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5)',[userId,email,name,await hash(password),role]); await session(res,userId); res.status(201).json({ok:true}); } catch(e){ if(e.code==='23505') throw fail(409,'البريد مسجّل مسبقًا.'); throw e; } }));
app.post('/api/auth/login',wrap(async(req,res)=>{ const {rows}=await query('SELECT id,password_hash FROM users WHERE email=$1',[emailKey(req.body.email)]); if(!rows.length || !(await verify(String(req.body.password||''),rows[0].password_hash))) throw fail(401,'البريد أو كلمة المرور غير صحيحة.'); await session(res,rows[0].id); res.json({ok:true}); }));
app.post('/api/auth/logout',wrap(async(req,res)=>{ const token=cookie(req); if(token) await query('DELETE FROM sessions WHERE token_hash=$1',[digestToken(token)]); res.clearCookie('school_session',{path:'/'}); res.json({ok:true}); }));
app.delete('/api/auth/account',requireUser,wrap(async(req,res)=>{
 const password=req.body?.password;
 if(typeof password!=='string'||!password) throw fail(400,'أدخل كلمة المرور لتأكيد حذف الحساب.');
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  const {rows}=await client.query('SELECT email,role,password_hash FROM users WHERE id=$1 FOR UPDATE',[req.actor.id]);
  if(!rows.length) throw fail(401,'سجّل الدخول أولاً.');
  if(rows[0].role==='admin') throw fail(403,'لا يمكن حذف حساب الإدارة من هنا.');
  if(!(await verify(password,rows[0].password_hash))) throw fail(401,'كلمة المرور غير صحيحة.');
  await client.query('DELETE FROM posts WHERE owner_id=$1',[req.actor.id]);
  await client.query('DELETE FROM channels WHERE owner_id=$1',[req.actor.id]);
  await client.query('DELETE FROM lectures WHERE owner_id=$1',[req.actor.id]);
  if(rows[0].role==='teacher') await client.query('DELETE FROM invites WHERE email=$1',[rows[0].email]);
  await client.query('DELETE FROM users WHERE id=$1',[req.actor.id]);
  await client.query('COMMIT');
 } catch(error) { await client.query('ROLLBACK'); throw error; }
 finally { client.release(); }
 res.clearCookie('school_session',{path:'/'});
 res.json({ok:true});
}));
app.get('/api/me',requireUser,wrap(async(req,res)=>{ const {id,email,name,role,subjects}=req.actor; res.json({id,email,name,role,subjects}); }));
app.get('/api/data',requireUser,wrap(async(req,res)=>{ const user=req.actor; const [c,l,j,i,n]=await Promise.all([query('SELECT id,handle,name,subject,book,description,owner_id AS "ownerId",teacher_name AS "teacherName",created_at AS "createdAt" FROM channels ORDER BY created_at DESC'),query(`SELECT l.id,title,subject,book,description,owner_id AS "ownerId",teacher_name AS "teacherName",created_at AS "createdAt",EXISTS(SELECT 1 FROM media m WHERE m.lecture_id=l.id AND kind='audio') AS "hasAudio",EXISTS(SELECT 1 FROM media m WHERE m.lecture_id=l.id AND kind='pdf') AS "hasPdf" FROM lectures l ORDER BY created_at DESC`),query('SELECT channel_id FROM memberships WHERE user_id=$1',[user.id]),user.role==='admin'?query('SELECT email,name,subjects,active FROM invites ORDER BY name'):Promise.resolve({rows:[]}),query('SELECT id,message,created_at AS "createdAt",read_at AS "readAt" FROM notifications WHERE student_id=$1 ORDER BY created_at DESC LIMIT 100',[user.id])]); res.json({channels:c.rows,lectures:l.rows.map(x=>({...x,audioUrl:x.hasAudio?`/api/lectures/${x.id}/media/audio`:'',pdfUrl:x.hasPdf?`/api/lectures/${x.id}/media/pdf`:''})),joined:j.rows.map(x=>x.channel_id),invites:i.rows,notifications:n.rows}); }));
app.get('/api/admin/students',requireUser,wrap(async(req,res)=>{ admin(req); const {rows}=await query(`SELECT u.id,u.name,u.email,u.course_number AS "courseNumber",u.created_at AS "createdAt",COALESCE(json_agg(DISTINCT c.subject) FILTER(WHERE c.subject IS NOT NULL),'[]'::json) AS subjects,COUNT(DISTINCT m.channel_id)::int AS "channelCount" FROM users u LEFT JOIN memberships m ON m.user_id=u.id LEFT JOIN channels c ON c.id=m.channel_id WHERE u.role='student' GROUP BY u.id ORDER BY u.created_at DESC`); res.json(rows); }));
app.get('/api/admin/students/:id',requireUser,wrap(async(req,res)=>{ admin(req); const {rows}=await query(`SELECT id,name,email,course_number AS "courseNumber",created_at AS "createdAt" FROM users WHERE id=$1 AND role='student'`,[req.params.id]);if(!rows.length)throw fail(404,'الطالب غير موجود.');const {rows:channels}=await query(`SELECT c.id,c.name,c.subject,c.book,c.handle FROM memberships m JOIN channels c ON c.id=m.channel_id WHERE m.user_id=$1 ORDER BY c.subject,c.name`,[req.params.id]);res.json({...rows[0],channels}); }));
app.patch('/api/admin/students/:id',requireUser,wrap(async(req,res)=>{ admin(req); const value=String(req.body.courseNumber||'').trim();if(value.length>30)throw fail(400,'رقم الدورة طويل جدًا.');const {rowCount}=await query(`UPDATE users SET course_number=$1 WHERE id=$2 AND role='student'`,[value||null,req.params.id]);if(!rowCount)throw fail(404,'الطالب غير موجود.');res.json({ok:true}); }));
app.post('/api/admin/students/:id/notifications',requireUser,wrap(async(req,res)=>{ admin(req);const message=String(req.body.message||'').trim();if(message.length<1||message.length>1000)throw fail(400,'اكتب إشعارًا من ١ إلى ١٠٠٠ حرف.');const {rowCount}=await query(`SELECT 1 FROM users WHERE id=$1 AND role='student'`,[req.params.id]);if(!rowCount)throw fail(404,'الطالب غير موجود.');await query(`INSERT INTO notifications(id,student_id,sender_id,message) VALUES($1,$2,$3,$4)`,[id(),req.params.id,req.actor.id,message]);res.status(201).json({ok:true}); }));
app.patch('/api/notifications/:id/read',requireUser,wrap(async(req,res)=>{ const {rowCount}=await query(`UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND student_id=$2`,[req.params.id,req.actor.id]);if(!rowCount)throw fail(404,'الإشعار غير موجود.');res.json({ok:true}); }));
app.get('/api/channels/:id/posts',requireUser,wrap(async(req,res)=>{ const {rows:channels}=await query('SELECT owner_id FROM channels WHERE id=$1',[req.params.id]); if(!channels.length) throw fail(404,'القناة غير موجودة.'); if(req.actor.role!=='admin' && channels[0].owner_id!==req.actor.id) { const {rowCount}=await query('SELECT 1 FROM memberships WHERE user_id=$1 AND channel_id=$2',[req.actor.id,req.params.id]); if(!rowCount) throw fail(403,'انضم إلى القناة أولاً.'); } const {rows}=await query('SELECT id,text,created_at AS "createdAt",image IS NOT NULL AS "hasImage" FROM posts WHERE channel_id=$1 ORDER BY created_at DESC',[req.params.id]); res.json(rows.map(x=>({...x,imageUrl:x.hasImage?`/api/posts/${x.id}/image`:''}))); }));
app.post('/api/invites',requireUser,wrap(async(req,res)=>{ admin(req); const email=emailKey(req.body.email),name=clean(req.body.name,70),subjects=[...new Set((Array.isArray(req.body.subjects)?req.body.subjects:[]).map(x=>clean(x,80)))]; if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!valid(name,70)||!subjects.length||subjects.length>20||subjects.some(x=>!valid(x,80))) throw fail(400,'تحقق من بيانات الأستاذ والمواد.'); const requested=String(req.body.inviteCode||'').trim();if(requested && !/^[A-Za-z0-9_-]{12,64}$/.test(requested))throw fail(400,'رمز الدعوة يجب أن يكون ١٢ إلى ٦٤ حرفًا إنجليزيًا أو رقمًا.');const code=requested||randomBytes(18).toString('base64url'); await query('INSERT INTO invites(email,name,subjects,active,code_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO UPDATE SET name=$2,subjects=$3,active=$4,code_hash=$5',[email,name,JSON.stringify(subjects),req.body.active===true,digestToken(code)]); res.json({ok:true,inviteCode:code}); }));
app.post('/api/channels',requireUser,wrap(async(req,res)=>{ teaches(req,req.body.subject); const {name,subject,book,description='',handle}=req.body; if(!valid(name,70)||!valid(book,100)||typeof description!=='string'||description.length>180||!/^([a-z][a-z0-9_]{3,23})$/.test(handle)) throw fail(400,'تحقق من اسم القناة والكتاب والمعرّف.'); const channelId=id(); try { await query('INSERT INTO channels(id,handle,name,subject,book,description,owner_id,teacher_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[channelId,handle,name.trim(),subject,book.trim(),description.trim(),req.actor.id,req.actor.name]); } catch(e){if(e.code==='23505')throw fail(409,'هذا المعرّف مستخدم لقناة أخرى.');throw e;} res.status(201).json({id:channelId}); }));
app.delete('/api/channels/:id',requireUser,wrap(async(req,res)=>{ await owner(req,'channels',req.params.id); await query('DELETE FROM channels WHERE id=$1',[req.params.id]); res.json({ok:true}); }));
app.post('/api/channels/:id/join',requireUser,wrap(async(req,res)=>{ const {rowCount}=await query('SELECT 1 FROM channels WHERE id=$1',[req.params.id]); if(!rowCount) throw fail(404,'القناة غير موجودة.'); await query('INSERT INTO memberships(user_id,channel_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.actor.id,req.params.id]); res.json({ok:true}); }));
app.delete('/api/channels/:id/join',requireUser,wrap(async(req,res)=>{ await query('DELETE FROM memberships WHERE user_id=$1 AND channel_id=$2',[req.actor.id,req.params.id]); res.json({ok:true}); }));
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:25*1024*1024,files:1}});
app.post('/api/channels/:id/posts',requireUser,upload.single('image'),wrap(async(req,res)=>{ await owner(req,'channels',req.params.id); const body=clean(req.body.text,3000),file=req.file; if(body.length>3000 || (!body&&!file) || (file && (!['image/png','image/jpeg','image/webp'].includes(file.mimetype)||file.size>5*1024*1024))) throw fail(400,'المنشور أو الصورة غير صالحة.'); await query('INSERT INTO posts(id,channel_id,owner_id,text,image,image_type) VALUES($1,$2,$3,$4,$5,$6)',[id(),req.params.id,req.actor.id,body,file?.buffer||null,file?.mimetype||null]); res.status(201).json({ok:true}); }));
app.delete('/api/posts/:id',requireUser,wrap(async(req,res)=>{ const {rows}=await query('SELECT c.* FROM posts p JOIN channels c ON c.id=p.channel_id WHERE p.id=$1',[req.params.id]); if(!rows.length) throw fail(404,'المنشور غير موجود.'); if(req.actor.role!=='admin'){if(rows[0].owner_id!==req.actor.id)throw fail(403,'غير مسموح.');teaches(req,rows[0].subject);} await query('DELETE FROM posts WHERE id=$1',[req.params.id]); res.json({ok:true}); }));
app.get('/api/posts/:id/image',requireUser,wrap(async(req,res)=>{ const {rows}=await query('SELECT p.image,p.image_type,p.channel_id,c.owner_id FROM posts p JOIN channels c ON c.id=p.channel_id WHERE p.id=$1',[req.params.id]); const p=rows[0]; if(!p?.image) throw fail(404,'الصورة غير موجودة.'); if(req.actor.role!=='admin' && p.owner_id!==req.actor.id){ const {rowCount}=await query('SELECT 1 FROM memberships WHERE user_id=$1 AND channel_id=$2',[req.actor.id,p.channel_id]);if(!rowCount)throw fail(403,'غير مسموح.');}res.type(p.image_type);res.set('Cache-Control','private, no-store');res.send(p.image); }));
app.post('/api/lectures',requireUser,wrap(async(req,res)=>{ const {title,subject,book,description=''}=req.body;teaches(req,subject);if(!valid(title,100)||!valid(book,100)||typeof description!=='string'||description.length>500)throw fail(400,'بيانات المحاضرة غير مكتملة.');const lectureId=id();await query('INSERT INTO lectures(id,title,subject,book,description,owner_id,teacher_name) VALUES($1,$2,$3,$4,$5,$6,$7)',[lectureId,title.trim(),subject,book.trim(),description.trim(),req.actor.id,req.actor.name]);res.status(201).json({id:lectureId}); }));
app.put('/api/lectures/:id',requireUser,wrap(async(req,res)=>{ const item=await owner(req,'lectures',req.params.id);if(req.body.subject!==item.subject||!valid(req.body.title,100)||!valid(req.body.book,100)||typeof req.body.description!=='string'||req.body.description.length>500)throw fail(400,'بيانات المحاضرة غير صالحة.');await query('UPDATE lectures SET title=$1,book=$2,description=$3 WHERE id=$4',[req.body.title.trim(),req.body.book.trim(),req.body.description.trim(),item.id]);res.json({ok:true}); }));
app.delete('/api/lectures/:id',requireUser,wrap(async(req,res)=>{ await owner(req,'lectures',req.params.id);await query('DELETE FROM lectures WHERE id=$1',[req.params.id]);res.json({ok:true}); }));
app.post('/api/lectures/:id/media/:kind',requireUser,upload.single('file'),wrap(async(req,res)=>{ await owner(req,'lectures',req.params.id);const kind=req.params.kind,file=req.file;if(!file||!['audio','pdf'].includes(kind)||kind==='pdf'&&file.mimetype!=='application/pdf'||kind==='audio'&&!file.mimetype.startsWith('audio/'))throw fail(400,'نوع الملف غير مدعوم.');await query('INSERT INTO media(id,lecture_id,kind,mime,content) VALUES($1,$2,$3,$4,$5) ON CONFLICT(lecture_id,kind) DO UPDATE SET mime=$4,content=$5',[id(),req.params.id,kind,file.mimetype,file.buffer]);res.json({ok:true}); }));
app.get('/api/lectures/:id/media/:kind',requireUser,wrap(async(req,res)=>{ const {rows}=await query('SELECT mime,content FROM media WHERE lecture_id=$1 AND kind=$2',[req.params.id,req.params.kind]);if(!rows.length)throw fail(404,'الملف غير موجود.');res.type(rows[0].mime);res.set('Cache-Control','private, no-store');res.set('Content-Disposition',`inline; filename="lecture-${req.params.id}.${req.params.kind==='pdf'?'pdf':'audio'}"`);res.send(rows[0].content); }));
app.use('/api',(req,res)=>res.status(404).json({error:'الطلب غير موجود.'}));
const dist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
app.use(express.static(dist,{index:false}));
app.use((req,res)=>res.sendFile(path.join(dist,'index.html')));
app.use((err,req,res,next)=>{ if(err.code==='LIMIT_FILE_SIZE')return res.status(413).json({error:'الملف أكبر من الحد المسموح.'}); if(err.code==='23503'||err.code==='22P02')return res.status(400).json({error:'بيانات الطلب غير صالحة.'});if(err.status)return res.status(err.status).json({error:err.message});console.error(err);res.status(500).json({error:'حدث خطأ في الخادم.'}); });
await init();
app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('School server listening'));
