import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdShieldProvider } from '@/app/AdShieldProvider'
import { LibraryProvider } from '@/app/LibraryProvider'
import { ThemeProvider } from '@/app/ThemeProvider'
import { AppShell } from '@/app/layout/AppShell'
import { HomePage } from '@/features/home/HomePage'
import { SearchPage } from '@/features/search/SearchPage'
import { WatchPage } from '@/features/player/WatchPage'
import { PlaylistsPage } from '@/features/playlists/PlaylistsPage'
import { PlaylistDetailPage } from '@/features/playlists/PlaylistDetailPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { FavoritesPage } from '@/features/favorites/FavoritesPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { LibraryPage } from '@/features/library/LibraryPage'
import { AboutPage } from '@/features/about/AboutPage'
import { AdShieldPage } from '@/features/adshield/AdShieldPage'
import { InstallGate } from '@/app/InstallGate'

export default function App() {
  return (
    <InstallGate>
      <LibraryProvider>
        <AdShieldProvider>
          <ThemeProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/watch/:source/:id" element={<WatchPage />} />
                  <Route path="/playlists" element={<PlaylistsPage />} />
                  <Route path="/playlists/:id" element={<PlaylistDetailPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/favorites" element={<FavoritesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/ad-shield" element={<AdShieldPage />} />
                  <Route path="/library" element={<LibraryPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ThemeProvider>
        </AdShieldProvider>
      </LibraryProvider>
    </InstallGate>
  )
}
