import { api, json, date } from './api.js';
export const loadStudents=()=>api('/admin/students');
export const loadStudent=id=>api(`/admin/students/${id}`);
export const saveCourse=(id,courseNumber)=>json(`/admin/students/${id}`,'PATCH',{courseNumber});
export const sendStudentNotification=(id,message)=>json(`/admin/students/${id}/notifications`,'POST',{message});
export const markNotificationRead=id=>json(`/notifications/${id}/read`,'PATCH',{});
export const formatDate=date;
export const loadData=()=>api('/data');
export const loadPosts=id=>api(`/channels/${id}/posts`);
export const saveInvite=payload=>json('/invites','POST',payload);
export const createChannel=async(_user,data)=>{const result=await json('/channels','POST',data);return result.id;};
export const removeChannel=channel=>api(`/channels/${channel.id}`,{method:'DELETE'});
export const joinChannel=(_uid,id)=>api(`/channels/${id}/join`,{method:'POST'});
export const leaveChannel=(_uid,id)=>api(`/channels/${id}/join`,{method:'DELETE'});
export async function createPost(_user,id,{text,image}) { const body=new FormData();body.set('text',text);if(image)body.set('image',image);return api(`/channels/${id}/posts`,{method:'POST',body}); }
export const removePost=(_id,post)=>api(`/posts/${post.id}`,{method:'DELETE'});
export async function saveLecture(_user,payload,current){const {audio,video,...details}=payload;const result=current?await json(`/lectures/${current.id}`,'PUT',details):await json('/lectures','POST',details);const id=current?.id||result.id;for(const [kind,file] of [['audio',audio],['video',video]])if(file){const body=new FormData();body.set('file',file);await api(`/lectures/${id}/media/${kind}`,{method:'POST',body});}return id;}
export const removeLecture=item=>api(`/lectures/${item.id}`,{method:'DELETE'});
