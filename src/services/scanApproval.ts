// What the departure overlay shows while a scan is being sent, and for how long the green "approved"
// state stays up afterwards. Pure (the timer is injected) so the rules can be run against a fake clock
// (tests/scanApproval.test.ts). It never starts, delays or retries the request: the caller owns that;
// this only mirrors what the existing request actually did.
//
//  - begin()          the request starts          -> overlay up, "pending" (stays up however long it takes)
//  - succeed(t, done) the request RESOLVED (the existing success path) -> "success" at once, no minimum
//                     loading time; `done` runs once, HOLD_MS later, when the overlay closes
//  - fail(t)          the request threw / was refused -> overlay closes at once (the existing error
//                     dialog takes over); never shown as success
//  - stageDone(t, s)  the request itself confirmed one thing (driver found, count valid, route computed,
//                     trip saved on the server) -> that square gets its green check. Only real
//                     confirmations are passed in; nothing is ever checked off by time.
//  - a ticket belongs to one request: an older request answering after a newer one began is ignored

export const APPROVAL_HOLD_MS = 1500;

export type ApprovalStage = 'pending' | 'success';
/** The four squares around the bus. */
export type VerifiedStage = 'passengers' | 'driver' | 'data' | 'location';
export interface ApprovalView { visible: boolean; stage: ApprovalStage; completed: readonly VerifiedStage[] }

export interface ApprovalTimers {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

export interface ApprovalPresenter {
  /** Starts a new request; returns its ticket. Cancels a success state that is still on screen. */
  begin(): number;
  /** The request confirmed one of the four things. Ignored unless `ticket` is the current, still pending request. */
  stageDone(ticket: number, stage: VerifiedStage): void;
  /** The request was confirmed. Ignored unless `ticket` is the current, still pending request. */
  succeed(ticket: number, onClosed?: () => void): void;
  /** The request failed. Ignored unless `ticket` is the current, still pending request. */
  fail(ticket: number): void;
  /** Clears the timer and the view (unmount). The presenter stays usable (React StrictMode remounts). */
  dispose(): void;
  view(): ApprovalView;
}

const realTimers: ApprovalTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createApprovalPresenter(opts: {
  onChange: (view: ApprovalView) => void;
  holdMs?: number;
  timers?: ApprovalTimers;
}): ApprovalPresenter {
  const hold = opts.holdMs ?? APPROVAL_HOLD_MS;
  const timers = opts.timers ?? realTimers;
  let state: 'idle' | 'pending' | 'success' = 'idle';
  let current = 0;
  let timer: unknown = null;
  let completed: VerifiedStage[] = [];

  const view = (): ApprovalView => ({ visible: state !== 'idle', stage: state === 'success' ? 'success' : 'pending', completed });
  const emit = () => opts.onChange(view());
  const stopTimer = () => { if (timer !== null) { timers.clear(timer); timer = null; } };

  return {
    begin() {
      stopTimer();
      current += 1;
      state = 'pending';
      completed = [];
      emit();
      return current;
    },
    stageDone(ticket, stage) {
      if (ticket !== current || state !== 'pending' || completed.includes(stage)) return;
      completed = [...completed, stage];
      emit();
    },
    succeed(ticket, onClosed) {
      if (ticket !== current || state !== 'pending') return;
      state = 'success';
      emit();
      timer = timers.set(() => {
        timer = null;
        state = 'idle';
        emit();
        onClosed?.();
      }, hold);
    },
    fail(ticket) {
      if (ticket !== current || state !== 'pending') return;
      state = 'idle';
      emit();
    },
    dispose() {
      stopTimer();
      current += 1; // a request still in flight can no longer touch the view
      state = 'idle';
      completed = [];
    },
    view,
  };
}
