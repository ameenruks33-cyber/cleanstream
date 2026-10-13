import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Menu, Search } from 'lucide-react'
import { Button } from '@/components/Button'
import { useLibrary } from '@/app/LibraryProvider'
import { searchOrWatchPath } from '@/lib/youtube'

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const { user } = useLibrary()
  const [query, setQuery] = useState(() => params.get('q') ?? '')

  useEffect(() => {
    if (location.pathname === '/search') {
      setQuery(params.get('q') ?? '')
    }
  }, [location.pathname, params])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const value = query.trim()
    const path = searchOrWatchPath(value)
    if (!path) return
    navigate(path)
  }

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-canvas/80 px-4 py-3 backdrop-blur">
      <Button className="px-2 md:hidden" aria-label="Open navigation" onClick={onMenu}>
        <Menu className="h-5 w-5" />
      </Button>
      <form onSubmit={onSubmit} className="flex flex-1 items-center gap-2" role="search">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search any YouTube video, or paste a link"
            aria-label="Search YouTube"
            className="w-full rounded-full border border-line bg-panel py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-muted focus:border-tide"
          />
        </div>
        <Button variant="primary" type="submit">
          Search
        </Button>
      </form>
      <Button variant="ghost" onClick={() => navigate('/settings')}>
        {user ? user.email : 'Guest'}
      </Button>
    </header>
  )
}
