/** Map the query script to a TMDB language so original-title search works without extra filters. */
export function detectTmdbLanguage(query: string): string | undefined {
  if (/[\u0600-\u06FF]/.test(query)) return 'ar-SA'
  if (/[\u0B80-\u0BFF]/.test(query)) return 'ta-IN'
  if (/[\u0900-\u097F]/.test(query)) return 'hi-IN'
  if (/[\u0980-\u09FF]/.test(query)) return 'bn-IN'
  if (/[\u0D00-\u0D7F]/.test(query)) return 'ml-IN'
  if (/[\u0C00-\u0C7F]/.test(query)) return 'te-IN'
  if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(query)) return 'ja-JP'
  if (/[\uAC00-\uD7AF]/.test(query)) return 'ko-KR'
  return undefined
}
