import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChannelPoll, validatePollChoice } from '../channel-poll-policy.js';

test('accepts a poll with two or more distinct options and trims whitespace',()=>{
 const poll=validateChannelPoll({question:'  أي وقت مناسب؟ ',options:[' صباحاً ',' مساءً ']});
 assert.deepEqual(poll,{question:'أي وقت مناسب؟',options:['صباحاً','مساءً']});
});
test('rejects invalid question and option length',()=>{
 for(const poll of [{question:'',options:['أ','ب']},{question:'x'.repeat(251),options:['أ','ب']},{question:'السؤال',options:['واحد']},{question:'السؤال',options:Array(9).fill('أ')},{question:'السؤال',options:['أ','أ']},{question:'السؤال',options:['أ','   ']},{question:'السؤال',options:['أ','x'.repeat(121)]}]) assert.throws(()=>validateChannelPoll(poll),{status:400});
});
test('allows only in-range integer votes',()=>{
 assert.equal(validatePollChoice(1,['أ','ب']),1);
 for(const bad of [-1,2,0.5,'1',null,undefined])assert.throws(()=>validatePollChoice(bad,['أ','ب']),{status:400});
});
