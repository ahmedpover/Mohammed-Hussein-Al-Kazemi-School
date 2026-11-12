import test from 'node:test';
import assert from 'node:assert/strict';
import {canRepresentativeManageChannel} from '../representative-policy.js';
const id='6ec3f98e-1029-4b7b-9c88-87b8b64ea444',channel='3f9eb26b-2cf8-4ee8-b9d8-08245bf9d2b7';
test('only explicitly joined representatives can administer a channel',async()=>{
 const queries=[];
 const query=async(sql,args)=>{queries.push({sql,args});return{rowCount:1};};
 assert.equal(await canRepresentativeManageChannel({id,role:'representative'},channel,query),true);
 assert.deepEqual(queries[0].args,[id,channel]);
 for(const role of ['student','teacher','admin'])assert.equal(await canRepresentativeManageChannel({id,role},channel,query),false);
 assert.equal(queries.length,1);
});
test('an unjoined representative cannot administer posts, polls or lectures',async()=>{
 const query=async()=>({rowCount:0});
 assert.equal(await canRepresentativeManageChannel({id,role:'representative'},channel,query),false);
 assert.equal(await canRepresentativeManageChannel({id,role:'representative'},'',query),false);
});
