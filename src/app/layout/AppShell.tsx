import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from '@/app/layout/Sidebar'
import { TopBar } from '@/app/layout/TopBar'
import { MobileNav } from '@/app/layout/MobileNav'
import { ConsentBanner } from '@/components/ConsentBanner'
import { Brand } from '@/components/Brand'

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <div className="grain" />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 pb-24 pt-6 md:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname + location.search}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <MobileNav />
      <ConsentBanner />
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-canvas/70" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-72 border-r border-line bg-panel p-4">
            <Brand />
            <div className="mt-6 flex flex-col gap-2">
              {[
                ['/', 'Home'],
                ['/search', 'Search'],
                ['/library', 'Library'],
                ['/favorites', 'Favorites'],
                ['/playlists', 'Playlists'],
                ['/history', 'History'],
                ['/settings', 'Settings'],
                ['/about', 'About'],
              ].map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-2xl px-3 py-2 text-sm text-muted hover:bg-raised hover:text-ink"
                >
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
