// The "waiting for the WhatsApp bot" mark on a ride.
//
// The site writes `botTodo: true` on every NEW ride. The bot listens only to rides that carry it,
// sends each one's message, and switches the mark off (`botTodo: false`) together with
// `botSentAt`. That is how it finds every ride it still owes a message - however long it was
// offline - without reading the trip history on every reconnect (whatsapp-bot/scan-listeners.js).
//
// Only the bot may switch the mark off, and nothing but a NEW ride may switch it on: every later
// write the site makes to an existing ride (edit, end of trip) must leave it out, otherwise an
// edit made from a copy that still shows `botTodo: true` would put an already-sent ride back in
// the bot's queue.
import type { Scan } from './db';

export function withBotMark<T extends object>(newScan: T): T & { botTodo: true } {
  return { ...newScan, botTodo: true };
}

export function withoutBotMark(scan: Scan): Omit<Scan, 'botTodo'> {
  const { botTodo: _mark, ...rest } = scan;
  return rest;
}
