import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadQuestion, canAnswerQuestion, canReadAnswer } from '../question-policy.js';
const privateTarget={audience:'teacher',studentId:'student-a',teacherId:'teacher-a',published:false};
const general={audience:'all',studentId:'student-a',teacherId:null,published:false};
test('unpublished targeted questions are restricted to student, recipient, and admin',()=>{
 assert.equal(canReadQuestion('student','student-a',privateTarget),true);
 assert.equal(canReadQuestion('student','student-b',privateTarget),false);
 assert.equal(canReadQuestion('teacher','teacher-a',privateTarget),true);
 assert.equal(canReadQuestion('teacher','teacher-b',privateTarget),false);
 assert.equal(canReadQuestion('admin','admin-a',privateTarget),true);
});
test('unpublished general questions are readable by all teachers and admins, not other students',()=>{
 assert.equal(canReadQuestion('teacher','teacher-b',general),true);
 assert.equal(canReadQuestion('admin','admin-a',general),true);
 assert.equal(canReadQuestion('student','student-b',general),false);
});
test('answer creation allows admins only on general questions and teachers on assigned/general',()=>{
 assert.equal(canAnswerQuestion('admin','admin-a',general),true);
 assert.equal(canAnswerQuestion('admin','admin-a',privateTarget),false);
 assert.equal(canAnswerQuestion('teacher','teacher-a',privateTarget),true);
 assert.equal(canAnswerQuestion('teacher','teacher-b',privateTarget),false);
 assert.equal(canAnswerQuestion('teacher','teacher-b',general),true);
 assert.equal(canAnswerQuestion('student','student-a',general),false);
});
test('public answers expose published question but never private answer to outsiders',()=>{
 const published={...privateTarget,published:true};
 const privateAnswer={visibility:'private',authorId:'teacher-a'};
 const publicAnswer={visibility:'public',authorId:'teacher-a'};
 assert.equal(canReadQuestion('student','student-b',published),true);
 assert.equal(canReadAnswer('student','student-b',published,privateAnswer),false);
 assert.equal(canReadAnswer('student','student-b',published,publicAnswer),true);
 assert.equal(canReadAnswer('student','student-a',published,privateAnswer),true);
 assert.equal(canReadAnswer('teacher','teacher-b',published,privateAnswer),false);
 assert.equal(canReadAnswer('teacher','teacher-a',published,privateAnswer),true);
 assert.equal(canReadAnswer('admin','admin-a',published,privateAnswer),true);
});
test('deleted target does not turn targeted question into general question',()=>{
 const deleted={...privateTarget,teacherId:null};
 assert.equal(canReadQuestion('teacher','teacher-b',deleted),false);
 assert.equal(canAnswerQuestion('admin','admin-a',deleted),false);
 assert.equal(canAnswerQuestion('teacher','teacher-b',deleted),false);
});
