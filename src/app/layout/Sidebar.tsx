import { NavLink } from 'react-router-dom'
import {
  Clock3,
  Heart,
  House,
  Info,
  Library,
  ListMusic,
  PanelLeft,
  Search,
  Settings,
  Shield,
} from 'lucide-react'
import { Brand } from '@/components/Brand'
import { Button } from '@/components/Button'
import { cn } from '@/lib/cn'

const links = [
  { to: '/', label: 'Home', icon: House },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/favorites', label: 'Favorites', icon: Heart },
  { to: '/playlists', label: 'Playlists', icon: ListMusic },
  { to: '/history', label: 'History', icon: Clock3 },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/ad-shield', label: 'Ad Shield', icon: Shield },
  { to: '/about', label: 'About', icon: Info },
]

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <aside
      className={cn(
        'hidden h-screen shrink-0 flex-col border-r border-line bg-panel/80 p-4 md:flex',
        collapsed ? 'w-[88px]' : 'w-[260px]',
      )}
    >
      <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between')}>
        <Brand collapsed={collapsed} />
        {!collapsed ? (
          <Button aria-label="Collapse sidebar" onClick={onToggle} className="px-2">
            <PanelLeft className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {collapsed ? (
        <Button aria-label="Expand sidebar" className="mt-4 px-2" onClick={onToggle}>
          <PanelLeft className="h-4 w-4" />
        </Button>
      ) : null}
      <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Primary">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-muted transition hover:bg-raised hover:text-ink',
                collapsed && 'justify-center px-0',
                isActive && 'bg-raised text-ink',
              )
            }
          >
            <link.icon className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>{link.label}</span> : <span className="sr-only">{link.label}</span>}
          </NavLink>
        ))}
      </nav>
      {!collapsed ? (
        <p className="px-2 text-[11px] leading-5 text-muted">
          Ad Shield blocks ads in MyTube — not inside YouTube’s official player.
        </p>
      ) : null}
    </aside>
  )
}
