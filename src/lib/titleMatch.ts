export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’"“”:.,!?()[\]{}]/g, '')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/[^a-z0-9\u0600-\u06ff\u0900-\u097f\u0b80-\u0bff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function titlesLikelyMatch(left: string, right: string): boolean {
  const a = normalizeTitle(left)
  const b = normalizeTitle(right)
  if (!a || !b) return false
  if (a === b) return true
  if (a.length < 4 || b.length < 4) return false
  return a.includes(b) || b.includes(a)
}

export function yearsLikelyMatch(left?: number, right?: number): boolean {
  if (!left || !right) return true
  return Math.abs(left - right) <= 1
}
