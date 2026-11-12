import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accentColor, contrast, themes } from '../src/theme.js'
import { keywordColor } from '../src/model.js'

const channelColors = ['#447ba4', '#ca8259', '#6b987c', '#9b7caa', '#c19b43', '#528f98', '#ba7587', '#7c8d53', '#7881ba', '#b26b55', '#509c8d', '#aa87a2', '#a59b66', '#6f91a1', '#9b8271']
test('channel and keyword accents remain readable against both themes', () => {
  const canonical = [...channelColors, ...Array.from({ length: 24 }, (_, i) => keywordColor(i))]
  for (const dark of [false, true]) {
    const colors = themes[dark ? 'echoDark' : 'echoLight'].colors
    for (const color of canonical) {
      const adjusted = accentColor(color, dark)
      assert.ok(contrast(adjusted, colors.raised) >= 4.5, `${color} -> ${adjusted}`)
    }
    assert.ok(contrast(colors['text-primary'], colors.surface) >= 7)
    assert.ok(contrast(colors['text-secondary'], colors.surface) >= 4.5)
    assert.equal(new Set(channelColors.map(color => accentColor(color, dark))).size, channelColors.length)
  }
})
