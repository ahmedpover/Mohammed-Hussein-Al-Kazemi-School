// Kept independent of HTTP/database libraries so the permission matrix is testable.
export function canReadQuestion(role,userId,q) {
  return role==='admin' || q.studentId===userId ||
    (role==='teacher' && (q.audience==='all' || q.teacherId===userId)) || q.published===true;
}
export function canAnswerQuestion(role,userId,q) {
  return role==='admin' ? q.audience==='all' : role==='teacher' && (q.audience==='all' || q.teacherId===userId);
}
export function canReadAnswer(role,userId,q,a) {
  return role==='admin' || a.visibility==='public' || q.studentId===userId || a.authorId===userId;
}
