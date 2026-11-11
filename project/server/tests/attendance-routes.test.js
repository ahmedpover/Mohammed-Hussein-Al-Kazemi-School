import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const srcUrl=new URL('../attendance.js',import.meta.url), policyUrl=new URL('../attendance-policy.js',import.meta.url).href;
const original=await readFile(srcUrl,'utf8');
const instrumented=original.replace("import express from 'express';",`const express={Router:()=>({routes:{},get(path,fn){this.routes['GET '+path]=fn;},post(path,fn){this.routes['POST '+path]=fn;}})};`).replace("from './attendance-policy.js'",`from '${policyUrl}'`);
const {createAttendanceRouter}=await import(`data:text/javascript;base64,${Buffer.from(instrumented).toString('base64')}`);
const gid='3f9eb26b-2cf8-4ee8-b9d8-08245bf9d2b7',uid='6ec3f98e-1029-4b7b-9c88-87b8b64ea444',other='6ec3f98e-1029-4b7b-9c88-87b8b64ea445',lid='9e5f937e-afd5-4828-ac65-507ce1a31cea';
async function call(router,method,path,actor,body={},params={},query={}){
 const handler=router.routes[method+' '+path];assert.ok(handler,'route exists');
 return new Promise((resolve,reject)=>{const res={status(n){this.code=n;return this;},json(body){resolve({status:this.code||200,body});}};handler({actor,body,params,query},res,reject);});
}
test('students cannot view administrative attendance rosters or reports',async()=>{
 const router=createAttendanceRouter({query:async()=>{throw Error('No query should execute');},pool:{},id:()=>lid});
 const student={id:uid,role:'student'},teacher={id:uid,role:'teacher'};
 for(const role of [student,teacher])for(const [route,params,query] of [['/groups',{},{}],['/report',{}, {month:'2026-11'}],['/students',{},{}],['/lessons/:lessonId',{lessonId:lid},{}]]){
   await assert.rejects(()=>call(router,'GET',route,role,{},params,query),{status:403});
 }
 await assert.rejects(()=>call(router,'POST','/lessons',student),{status:403});
});
test('student self-history never accepts another student id from query',async()=>{
 const sqlArgs=[];
 const router=createAttendanceRouter({query:async(sql,args)=>{sqlArgs.push(args);return{rows:sql.includes('AS absences')?[{absences:1,delays:2,presents:3}]:[]};},pool:{},id:()=>lid});
 const result=await call(router,'GET','/me',{id:uid,role:'student'}, {},{}, {studentId:other});
 assert.equal(result.status,200);assert.equal(result.body.totals.absences,1);
 assert.equal(sqlArgs.length,2);assert.ok(sqlArgs.every(args=>args.length===1&&args[0]===uid));
});
test('cannot overwrite saved day/period without opening existing lesson explicitly',async()=>{
 const queries=[];
 const pool={connect:async()=>({query:async(sql,args=[])=>{queries.push(sql);
   if(sql.includes('SELECT id,name FROM student_groups'))return{rows:[{id:gid,name:'المرحلة الأولى'}]};
   if(sql.includes('SELECT id FROM attendance_lessons'))return{rows:[{id:lid}]};
   return{rows:[]};
 },release(){}})};
 const router=createAttendanceRouter({query:async()=>({rows:[]}),pool,id:()=>lid});
 const payload={groupId:gid,lessonDate:'2026-11-11',period:1,subject:'فقه',finalize:true,entries:[{studentId:uid,status:'absent'}]};
 await assert.rejects(()=>call(router,'POST','/lessons',{id:other,role:'admin'},payload),{status:409});
 assert.ok(queries.some(s=>s==='ROLLBACK'));assert.equal(queries.some(s=>s.includes('UPDATE attendance_lessons')),false);
});
test('admin can save all students and audit state changes atomically',async()=>{
 const sql=[];
 const pool={connect:async()=>({query:async(statement,args=[])=>{sql.push({statement,args});
   if(statement.includes('SELECT id,name FROM student_groups'))return{rows:[{id:gid,name:'المرحلة الأولى'}]};
   if(statement.includes('SELECT id FROM attendance_lessons'))return{rows:[]};
   if(statement.includes('FROM student_group_members'))return{rows:[{id:uid,name:'أحمد'},{id:other,name:'علي'}]};
   return{rows:[],rowCount:1};},release(){}})};
 const router=createAttendanceRouter({query:async()=>({rows:[]}),pool,id:()=>lid});
 const payload={groupId:gid,lessonDate:'2026-11-11',period:1,subject:'فقه',finalize:false,entries:[{studentId:uid,status:'absent'},{studentId:other,status:'present'}]};
 const result=await call(router,'POST','/lessons',{id:uid,role:'admin'},payload);
 assert.equal(result.status,201);assert.equal(result.body.ok,true);
 assert.equal(sql.filter(x=>x.statement.includes('INSERT INTO attendance_entries')).length,2);
 assert.equal(sql.filter(x=>x.statement.includes('INSERT INTO attendance_audit')).length,2);
 assert.ok(sql.some(x=>x.statement==='COMMIT'));
});
