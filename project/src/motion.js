import { useCallback, useState } from 'react';
import { flushSync } from 'react-dom';

// Batch simultaneous navigation updates so opening a page and resetting its
// selection share one short transition. Form fields and data refreshes stay instant.
const transitions = new WeakMap();
function smoothUpdate(update) {
  const region = document.querySelector('.cloud-app .main-content, .entry-content');
  if (!region || !region.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  let state = transitions.get(region);
  if (!state) {
    state = { queue: [], running: false };
    transitions.set(region, state);
  }
  state.queue.push(update);
  if (state.running) return;
  state.running = true;
  const run = async () => {
    let activeAnimation;
    try {
      while (state.queue.length && region.isConnected) {
        if (document.startViewTransition) {
          const transition = document.startViewTransition(() => {
            const pending = state.queue.splice(0);
            flushSync(() => pending.forEach(action => action()));
          });
          await transition.finished;
          continue;
        }
        const exit = region.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 70, easing: 'ease-in', fill: 'forwards' });
        activeAnimation = exit;
        await exit.finished;
        const pending = state.queue.splice(0);
        flushSync(() => pending.forEach(action => action()));
        exit.cancel();
        if (!region.isConnected) break;
        const enter = region.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.2,0,.2,1)' });
        activeAnimation = enter;
        await enter.finished;
      }
    } catch {
      // Navigation can remove a region before its animation finishes.
    } finally {
      activeAnimation?.cancel();
      // Apply any last update even if navigation removed the animated region.
      state.queue.splice(0).forEach(action => action());
      state.running = false;
    }
  };
  void run();
}

export function useMotionState(initial) {
  const [value, setValue] = useState(initial);
  const setSmoothValue = useCallback(next => smoothUpdate(() => setValue(next)), []);
  return [value, setSmoothValue];
}
