import { useCallback, useState } from 'react';
import { flushSync } from 'react-dom';

// One gesture can change several React states (for example: page + selected
// lecture). Commit them in the SAME view transition instead of showing a
// blank frame or playing two sequential animations.
const transitions = new WeakMap();
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

function commit(updates) {
  flushSync(() => {
    updates.forEach(update => update());
  });
}

function smoothUpdate(update) {
  const region = document.querySelector('.cloud-app .main-content, .entry-content');
  if (!region || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }

  let state = transitions.get(region);
  if (!state) {
    state = { pending: [], running: false, scheduled: false, active: null };
    transitions.set(region, state);
  }
  state.pending.push(update);

  // Rapid taps should not force users to watch an outdated transition.
  if (state.running) {
    state.active?.skipTransition?.();
    state.active?.cancel?.();
    return;
  }
  if (state.scheduled) return;
  state.scheduled = true;

  // Defer until the current click handler completes, collecting all its updates.
  queueMicrotask(async () => {
    state.scheduled = false;
    if (state.running) return;
    state.running = true;
    try {
      while (state.pending.length) {
        const updates = state.pending.splice(0);
        if (!region.isConnected || document.hidden) {
          commit(updates);
          continue;
        }

        if (typeof document.startViewTransition === 'function') {
          // The browser keeps the old view visible while it draws the new view.
          let committed = false;
          try {
            const transition = document.startViewTransition(() => {
              committed = true;
              commit(updates);
            });
            state.active = transition;
            await transition.finished;
          } catch {
            // A skipped/failed browser transition must never lose a click.
            if (!committed) commit(updates);
          }
        } else {
          // Older browsers: never fade the existing page to zero BEFORE updating.
          // Show the new content immediately, then give it a subtle entrance.
          commit(updates);
          if (region.isConnected && typeof region.animate === 'function') {
            const animation = region.animate(
              [
                { opacity: 0.94, transform: 'translateY(7px)' },
                { opacity: 1, transform: 'translateY(0)' },
              ],
              { duration: 220, easing: EASING }
            );
            state.active = animation;
            try { await animation.finished; } catch { /* Interrupted by another tap. */ }
          }
        }
        state.active = null;
      }
    } finally {
      state.active = null;
      state.running = false;
      // Protect queued updates if a browser aborts a transition unexpectedly.
      if (state.pending.length) commit(state.pending.splice(0));
    }
  });
}

export function useMotionState(initial) {
  const [value, setValue] = useState(initial);
  const setSmoothValue = useCallback(next => smoothUpdate(() => setValue(next)), []);
  return [value, setSmoothValue];
}
