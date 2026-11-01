import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePoll, validVoteIndex } from '../poll-policy.js';

test('accepts 2 to 10 options and trims question and answers', () => {
  assert.deepEqual(validatePoll({ question: '  موعد الدرس؟ ', options: [' صباحاً ', 'مساءً'] }), {question:'موعد الدرس؟',options:['صباحاً','مساءً']});
  assert.equal(validatePoll({question:'سؤال',options:Array.from({length:10},(_,i)=>String(i))}).options.length,10);
});
test('rejects missing, excess and repeated options', () => {
  for (const options of [['واحد'], Array.from({length:11},(_,i)=>String(i)), ['نعم',' نعم '], ['A','a'], ['نعم','  ']]) {
    assert.throws(() => validatePoll({question:'استفتاء',options}));
  }
  assert.throws(() => validatePoll({question:'',options:['نعم','لا']}));
  assert.throws(() => validatePoll({question:'س'.repeat(241),options:['نعم','لا']}));
  assert.throws(() => validatePoll({question:'استفتاء',options:['نعم','س'.repeat(121)]}));
});
test('only an in-range integer is a vote', () => {
  assert.equal(validVoteIndex(0,2),true);
  assert.equal(validVoteIndex(1,2),true);
  for (const value of [-1,2,1.5,'1',null,NaN]) assert.equal(validVoteIndex(value,2),false);
});
