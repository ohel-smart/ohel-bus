// Run: node --test tests/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withBotMark, withoutBotMark } from '../src/services/botMark.ts';
import type { Scan } from '../src/services/db.ts';

const scan = { id: 'scn_1', scannedAt: '2026-11-08T10:00:00.000Z', passengersCount: 12 } as unknown as Scan;

test('a new ride is marked as waiting for the bot, and nothing else about it changes', () => {
  const marked = withBotMark(scan);
  assert.equal(marked.botTodo, true);
  assert.deepEqual({ ...marked, botTodo: undefined }, { ...scan, botTodo: undefined });
  assert.equal('botTodo' in scan, false, 'the input is not modified');
});

test('a write to an existing ride never carries the mark, whatever the cached copy says', () => {
  for (const cached of [true, false, undefined]) {
    const payload = withoutBotMark({ ...scan, botTodo: cached } as Scan);
    assert.equal('botTodo' in payload, false);
    assert.equal(payload.id, 'scn_1');
    assert.equal(payload.passengersCount, 12);
  }
});
