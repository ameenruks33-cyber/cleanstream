import { WATCH_REGIONS } from '@/data/watchRegions'

export function RegionSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (country: string) => void
}) {
  return (
    <label className="flex min-w-[12rem] flex-col gap-1 text-xs text-muted">
      Watch region
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-full border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-tide"
        aria-label="Watch region"
      >
        {WATCH_REGIONS.map((region) => (
          <option key={region.code} value={region.code}>
            {region.name} ({region.code})
          </option>
        ))}
      </select>
    </label>
  )
}
