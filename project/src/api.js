export async function api(path, options={}) {
 const response=await fetch('/api'+path,{credentials:'same-origin',...options,headers:options.body instanceof FormData?options.headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
 const type=response.headers.get('content-type')||'';
 const data=type.includes('application/json')?await response.json():null;
 if(!response.ok)throw new Error(data?.error||'تعذر الاتصال بالخادم.');
 return data;
}
export const json=(path,method,body)=>api(path,{method,body:JSON.stringify(body)});
export async function me(){try{return await api('/me');}catch(error){if(error.message==='سجّل الدخول أولاً.')return null;throw error;}}
export const logout=()=>api('/auth/logout',{method:'POST'});
export const deleteAccount=password=>json('/auth/account','DELETE',{password});
export const date=value=>value?new Intl.DateTimeFormat('ar-IQ',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value)):'الآن';
