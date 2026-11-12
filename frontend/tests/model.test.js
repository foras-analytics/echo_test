import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareInstants, contextRows, highlightedParts, timelineLanes, nearestMessage, inputTime, inputToInstant } from '../src/model.js'
const messages = Array.from({ length: 20 }, (_, i) => ({ id: `m${i}`, channelId: i % 2 ? 'b' : 'a', timestampMs: i * 1000 }))

test('overlapping contexts merge without duplicates and retain independent reasons', () => {
  const base = ['m4', 'm5', 'm8', 'm15']
  const rows = contextRows(base, new Set(['m4', 'm8']), messages, 2)
  assert.equal(new Set(rows.map(r => r.id)).size, rows.length)
  const grouped = rows.filter(r => r.group)
  assert.deepEqual(grouped.map(r => r.id), ['m0', 'm2', 'm4', 'm6', 'm8', 'm10', 'm12'])
  assert.equal(new Set(grouped.map(r => r.group)).size, 1)
  assert.deepEqual(rows.find(r => r.id === 'm6').reasons, ['m4', 'm8'])
  assert.deepEqual(rows.filter(r => r.anchor).map(r => r.id), ['m4', 'm8'])
  assert.deepEqual(rows.filter(r => !r.group).map(r => r.id), ['m5', 'm15'])
  const closed = contextRows(base, new Set(['m8']), messages, 2)
  assert.equal(closed.filter(r => r.id === 'm4').length, 1)
  assert.equal(closed.some(r => r.id === 'm0'), false)
  assert.equal(closed.find(r => r.id === 'm6').reasons.length, 1)
})
test('different-channel groups stay together at earliest anchor positions', () => {
  const rows = contextRows(['m4', 'm5', 'm8'], new Set(['m4', 'm5']), messages, 1)
  assert.deepEqual(rows.map(r => r.id), ['m2', 'm4', 'm6', 'm3', 'm5', 'm7', 'm8'])
})
test('filter precedence removes excluded anchors and changing neighbor count recomputes ownership', () => {
  const rows = contextRows(['m8'], new Set(['m4', 'm8']), messages, 1)
  assert.deepEqual(rows.map(r => r.id), ['m6', 'm8', 'm10'])
  assert.deepEqual(contextRows(['m8'], new Set(['m8']), messages, 0).map(r => r.id), ['m8'])
})
test('lane split does not promote channels on deselection', () => {
  const order = ['a', 'b', 'c', 'd']
  assert.deepEqual(timelineLanes(order, ['b', 'c', 'd'], 2), [{ id: 'b', members: ['b'] }, { id: 'other', members: ['c', 'd'] }])
  assert.deepEqual(timelineLanes(order, ['a', 'b'], 2), [{ id: 'a', members: ['a'] }, { id: 'b', members: ['b'] }])
})
test('nearest timeline result seeks both directions and chooses earlier ties', () => {
  assert.equal(nearestMessage(messages, 4500).id, 'm4')
  assert.equal(nearestMessage(messages, 4900).id, 'm5')
  assert.equal(nearestMessage(messages, -1).id, 'm0')
  assert.equal(nearestMessage([], 1000), null)
})
test('literal overlapping highlights preserve the complete original text', () => {
  const text = 'ALPHAlpha [a-z] Müller Mueller <b>plain</b>'
  const words = [{ id: 'a', text: 'alpha' }, { id: 'b', text: 'lpha' }, { id: 'c', text: '[a-z]' }, { id: 'd', text: 'Müller' }]
  const parts = highlightedParts(text, words)
  assert.equal(parts.map(p => p.text).join(''), text)
  assert.ok(parts.some(p => p.keywords.length === 2))
  assert.ok(parts.find(p => p.text.includes('[a-z]')).keywords.some(k => k.id === 'c'))
  assert.equal(parts.find(p => p.text.includes('Mueller')).keywords.length, 0)
  const dotted = highlightedParts('İAlpha', [{ id: 'a', text: 'alpha' }])
  assert.deepEqual(dotted.map(p => p.text), ['İ', 'Alpha'])
})
test('shared fixed clock is independent of system timezone and preserves instants', () => {
  const ms = Date.parse('2026-10-25T01:30:00.123Z')
  for (const offset of [0, 60, -240, 345]) {
    assert.equal(Number(inputToInstant(inputTime(ms, offset), offset)) * 1000, ms)
  }
})
test('exact instant comparison does not collapse sub-millisecond values', () => {
  assert.equal(compareInstants('123.0000000002', '123.0000000001'), 1)
  assert.equal(compareInstants('-0.9', '-0.1'), -1)
  assert.equal(compareInstants('123.1000', '123.1'), 0)
})
