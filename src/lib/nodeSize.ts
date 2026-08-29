import type { Person } from '../types'

export const NODE_HEIGHT = 72
export const MIN_NODE_WIDTH = 120
export const MAX_NODE_WIDTH = 340
// Visual gap kept between two adjacent boxes, on top of their own widths.
export const GUTTER = 20

// Rough average glyph width for the card's name (Playfair Display, 600,
// 13px) — a per-character estimate rather than real canvas measurement, so
// this stays a plain, testable function; the box is padded generously
// enough that small estimation error never causes real truncation.
const AVG_CHAR_WIDTH = 7.6
const ICON_AND_PADDING = 10 /* gender shape */ + 6 /* gap */ + 20 /* left+right padding */

function deathSuffixText(person: Person): string {
  if (!person.deathDate) return ''
  const year = new Date(person.deathDate).getFullYear()
  return Number.isNaN(year) ? '' : ` (ö. ${year})`
}

// The width every zoom level reserves for this person — sized to the
// longest text the card view will ever show (name + death year), so
// nothing has to truncate when zoomed all the way in. Dot view ignores
// this entirely (it's a fixed small shape regardless of name length).
export function cardWidthFor(person: Person): number {
  const text = person.name + deathSuffixText(person)
  const textWidth = text.length * AVG_CHAR_WIDTH
  const width = Math.ceil(textWidth + ICON_AND_PADDING)
  return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, width))
}
