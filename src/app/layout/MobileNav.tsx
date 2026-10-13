import { NavLink } from 'react-router-dom'
import { Heart, House, Library, Search } from 'lucide-react'
import { cn } from '@/lib/cn'

const links = [
  { to: '/', label: 'Home', icon: House },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/favorites', label: 'Saved', icon: Heart },
]

export function MobileNav() {
  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-panel/95 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
    >
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 rounded-xl py-1 text-[11px] text-muted',
              isActive && 'text-ink',
            )
          }
        >
          <link.icon className="h-4 w-4" />
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
