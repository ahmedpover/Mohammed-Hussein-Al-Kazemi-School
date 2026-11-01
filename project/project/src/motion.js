import { useCallback, useState } from 'react';
import { flushSync } from 'react-dom';

// Clean, single-layer navigation for phones and desktop.
// A crossfade or View Transition keeps a screenshot of the previous page above
// the next one. On pages with different layouts it causes overlapping headings
// and cards. We animate ONLY the newly committed DOM, with no opacity change.
const transitions = new WeakMap();
const DURATION = 235;
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

function commit(updates) {
  flushSync(() => {
    updates.forEach(update => update());
  });
}

function smoothUpdate(update) {
  const region = document.querySelector('.cloud-app .main-content, .entry-content');
  if (!region || document.hidden || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }

  let state = transitions.get(region);
  if (!state) {
    state = { pending: [], running: false, scheduled: false, active: null };
    transitions.set(region, state);
  }
  state.pending.push(update);

  // A second tap interrupts the current entrance animation immediately.
  if (state.running) {
    state.active?.cancel?.();
    return;
  }
  if (state.scheduled) return;
  state.scheduled = true;

  // One click can update the active page and a selected lecture together.
  // Coalesce those updates so the user sees one transition, not two.
  queueMicrotask(async () => {
    state.scheduled = false;
    if (state.running) return;
    state.running = true;
    try {
      while (state.pending.length) {
        const updates = state.pending.splice(0);
        commit(updates);

        if (!region.isConnected || document.hidden ||
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
            typeof region.animate !== 'function') continue;

        // New page is fully opaque from the FIRST frame. The previous React
        // tree is already gone, and no browser snapshots are crossfaded.
        const animation = region.animate(
          [
            { transform: 'translate3d(0, 7px, 0)', opacity: 1 },
            { transform: 'translate3d(0, 0, 0)', opacity: 1 },
          ],
          { duration: DURATION, easing: EASING, fill: 'none' }
        );
        state.active = animation;
        try { await animation.finished; } catch { /* Latest tap takes priority. */ }
        state.active = null;
      }
    } finally {
      state.active = null;
      state.running = false;
      // Do not lose updates if a browser cancels an animation unexpectedly.
      if (state.pending.length) commit(state.pending.splice(0));
    }
  });
}

export function useMotionState(initial) {
  const [value, setValue] = useState(initial);
  const setSmoothValue = useCallback(next => smoothUpdate(() => setValue(next)), []);
  return [value, setSmoothValue];
}
