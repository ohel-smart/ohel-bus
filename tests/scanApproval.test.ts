// Run with: node --test tests/scanApproval.test.ts   (Node 24 runs TypeScript directly)
import test from 'node:test';
import assert from 'node:assert';
import { createApprovalPresenter, APPROVAL_HOLD_MS, type ApprovalView } from '../src/services/scanApproval.ts';

const shape = (v: ApprovalView) => ({ visible: v.visible, stage: v.stage });

// A fake clock: timers only fire when the test advances time.
function setup() {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers = {
    set: (fn: () => void, ms: number) => { const id = nextId++; pending.set(id, { at: now + ms, fn }); return id; },
    clear: (h: unknown) => { pending.delete(h as number); },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, t] of [...pending]) if (t.at <= now) { pending.delete(id); t.fn(); }
  };
  const views: ApprovalView[] = [];
  const presenter = createApprovalPresenter({ onChange: v => views.push(v), timers });
  return { presenter, views, advance, timersPending: () => pending.size };
}

test('a slow request keeps the loading overlay up, however long it takes, with no timer running', () => {
  const { presenter, views, advance, timersPending } = setup();
  presenter.begin();
  assert.deepStrictEqual(shape(presenter.view()), { visible: true, stage: 'pending' });
  advance(60_000);
  assert.deepStrictEqual(shape(presenter.view()), { visible: true, stage: 'pending' });
  assert.strictEqual(timersPending(), 0, 'nothing is timed while the request is unresolved (no fake progress, no minimum)');
  assert.strictEqual(views.length, 1);
});

test('a fast success shows the green approval at once (no minimum loading time), holds 1.5 s, closes once', () => {
  const { presenter, views, advance } = setup();
  let closed = 0;
  const t = presenter.begin();
  presenter.succeed(t, () => closed++); // resolved immediately after begin
  assert.deepStrictEqual(shape(presenter.view()), { visible: true, stage: 'success' });
  advance(APPROVAL_HOLD_MS - 1);
  assert.deepStrictEqual(shape(presenter.view()), { visible: true, stage: 'success' });
  assert.strictEqual(closed, 0);
  advance(1);
  assert.deepStrictEqual(shape(presenter.view()), { visible: false, stage: 'pending' });
  assert.strictEqual(closed, 1);
  advance(10_000);
  assert.strictEqual(closed, 1, 'the closing step runs exactly once');
  assert.deepStrictEqual(views.map(v => (v.visible ? v.stage : 'closed')), ['pending', 'success', 'closed'], 'success shows once');
});

test('a rejection or a thrown error is never shown as success: the overlay just closes', () => {
  const { presenter, views } = setup();
  let closed = 0;
  const t = presenter.begin();
  presenter.fail(t);
  assert.strictEqual(presenter.view().visible, false);
  presenter.succeed(t, () => closed++); // a late "success" for a request that already failed is ignored
  assert.strictEqual(presenter.view().visible, false);
  assert.strictEqual(closed, 0);
  assert.ok(!views.some(v => v.stage === 'success'));
});

test('a failure after the approval was shown does not take it back or fire twice', () => {
  const { presenter, advance } = setup();
  let closed = 0;
  const t = presenter.begin();
  presenter.succeed(t, () => closed++);
  presenter.fail(t);
  assert.deepStrictEqual(shape(presenter.view()), { visible: true, stage: 'success' });
  advance(APPROVAL_HOLD_MS);
  assert.strictEqual(closed, 1);
});

test('an older request answering after a newer one began cannot approve it (stale response)', () => {
  const { presenter } = setup();
  let closedOld = 0, closedNew = 0;
  const old = presenter.begin();
  const fresh = presenter.begin();
  presenter.succeed(old, () => closedOld++);
  assert.deepStrictEqual(shape(presenter.view()), { visible: true, stage: 'pending' }, 'the new scan is still pending');
  presenter.fail(old);
  assert.deepStrictEqual(shape(presenter.view()), { visible: true, stage: 'pending' });
  presenter.succeed(fresh, () => closedNew++);
  assert.deepStrictEqual(shape(presenter.view()), { visible: true, stage: 'success' });
  assert.strictEqual(closedOld, 0);
  assert.strictEqual(closedNew, 0);
});

test('a second answer for the same request (duplicate) is ignored', () => {
  const { presenter, advance } = setup();
  let closed = 0;
  const t = presenter.begin();
  presenter.succeed(t, () => closed++);
  presenter.succeed(t, () => closed++);
  advance(APPROVAL_HOLD_MS * 3);
  assert.strictEqual(closed, 1);
});

test('a new request during the success hold cancels the old closing step', () => {
  const { presenter, advance } = setup();
  let closedOld = 0;
  const a = presenter.begin();
  presenter.succeed(a, () => closedOld++);
  advance(500);
  const b = presenter.begin();
  assert.deepStrictEqual(shape(presenter.view()), { visible: true, stage: 'pending' });
  advance(APPROVAL_HOLD_MS * 2);
  assert.strictEqual(closedOld, 0, "the first scan's confetti/toast must not fire for the second scan");
  assert.deepStrictEqual(shape(presenter.view()), { visible: true, stage: 'pending' }, 'the second scan is still pending');
  presenter.fail(b);
  assert.strictEqual(presenter.view().visible, false);
});

test('unmount: the timer is cleared, a late answer is ignored, and the presenter works again (StrictMode)', () => {
  const { presenter, advance, timersPending } = setup();
  let closed = 0;
  const t = presenter.begin();
  presenter.succeed(t, () => closed++);
  assert.strictEqual(timersPending(), 1);
  presenter.dispose();
  assert.strictEqual(timersPending(), 0);
  advance(APPROVAL_HOLD_MS * 2);
  assert.strictEqual(closed, 0);

  const inFlight = presenter.begin();
  presenter.dispose();
  presenter.succeed(inFlight, () => closed++); // answer arrives after unmount
  assert.strictEqual(presenter.view().visible, false);
  assert.strictEqual(timersPending(), 0);

  const again = presenter.begin(); // remounted
  presenter.succeed(again, () => closed++);
  advance(APPROVAL_HOLD_MS);
  assert.strictEqual(closed, 1);
});

test('green checks appear only when the request itself confirms them, in the order confirmed', () => {
  const { presenter, advance } = setup();
  const t = presenter.begin();
  assert.deepStrictEqual(presenter.view().completed, [], 'nothing is checked off by time');
  advance(30_000);
  assert.deepStrictEqual(presenter.view().completed, []);
  presenter.stageDone(t, 'driver');
  presenter.stageDone(t, 'passengers');
  assert.deepStrictEqual(presenter.view().completed, ['driver', 'passengers']);
  presenter.stageDone(t, 'driver'); // the same confirmation twice counts once
  assert.deepStrictEqual(presenter.view().completed, ['driver', 'passengers']);
  presenter.stageDone(t, 'location');
  presenter.stageDone(t, 'data');
  assert.deepStrictEqual(presenter.view().completed, ['driver', 'passengers', 'location', 'data']);
});

test('a confirmation that never came (e.g. the route was only estimated) leaves that square unchecked, even on success', () => {
  const { presenter } = setup();
  const t = presenter.begin();
  presenter.stageDone(t, 'driver');
  presenter.stageDone(t, 'passengers');
  presenter.stageDone(t, 'data'); // saved, but the route was the rough estimate: no 'location'
  presenter.succeed(t);
  assert.deepStrictEqual(presenter.view().completed, ['driver', 'passengers', 'data']);
  assert.ok(!presenter.view().completed.includes('location'));
});

test('checks from an older request, or after the request ended, are ignored; a new request starts clean', () => {
  const { presenter } = setup();
  const old = presenter.begin();
  presenter.stageDone(old, 'driver');
  const fresh = presenter.begin();
  assert.deepStrictEqual(presenter.view().completed, [], 'a new scan does not inherit the old checks');
  presenter.stageDone(old, 'data'); // late confirmation of the old scan
  assert.deepStrictEqual(presenter.view().completed, []);
  presenter.stageDone(fresh, 'driver');
  presenter.fail(fresh);
  presenter.stageDone(fresh, 'passengers'); // after the failure
  assert.deepStrictEqual(shape(presenter.view()), { visible: false, stage: 'pending' });
  assert.deepStrictEqual(presenter.view().completed, ['driver'], 'frozen as it was; the overlay is closed anyway');
  const next = presenter.begin();
  assert.deepStrictEqual(presenter.view().completed, []);
  presenter.succeed(next);
  presenter.stageDone(next, 'data'); // after success: ignored
  assert.deepStrictEqual(presenter.view().completed, []);
});
