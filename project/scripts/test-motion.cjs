// Regression tests: no old-page screenshots, no transparent frames, fast taps.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/motion.js'), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export function useMotionState', 'function useMotionState');

async function run({ reduced = false, rapid = false } = {}) {
  let page = 'home', commits = 0, animations = 0, snapshots = 0;
  const calls = [];
  const region = {
    isConnected: true,
    animate(frames, opts) {
      animations++;
      calls.push({ frames, opts });
      assert.ok(frames.every(frame => frame.opacity === 1), 'new view must remain opaque');
      let reject;
      const finished = rapid ? new Promise((_resolve, rej) => { reject = rej; }) : Promise.resolve();
      return { finished, cancel() { reject?.(new Error('interrupted')); } };
    }
  };
  const document = {
    hidden: false,
    querySelector: () => region,
    startViewTransition() { snapshots++; throw Error('Never take snapshots of the old page'); }
  };
  const window = { matchMedia: () => ({ matches: reduced }) };
  const flushSync = callback => { commits++; callback(); };
  const useState = initial => [page, next => { page = typeof next === 'function' ? next(page) : next; }];
  const useCallback = fn => fn;
  const useMotionState = new Function('useState', 'useCallback', 'flushSync', 'document', 'window', 'queueMicrotask',
    source + '\nreturn useMotionState;')(useState, useCallback, flushSync, document, window, queueMicrotask);
  const [, setPage] = useMotionState('home');
  setPage('channels');
  setPage('lectures');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(page, 'lectures');
  assert.equal(snapshots, 0);
  assert.equal(commits, reduced ? 0 : 1);
  assert.equal(animations, reduced ? 0 : 1);
  if (rapid) {
    setPage('notifications');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(page, 'notifications');
    assert.equal(animations, 2);
  }
  if (!reduced) {
    assert.equal(calls[0].opts.fill, 'none');
    assert.ok(!calls[0].frames.some(frame => frame.opacity < 1));
  }
}

(async () => {
  await run();
  await run({ reduced: true });
  await run({ rapid: true });
  console.log('All motion regression checks passed (no ghosts, reduced motion, rapid taps).');
})().catch(error => { console.error(error); process.exitCode = 1; });
