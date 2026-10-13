import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LibraryProvider } from '@/app/LibraryProvider'
import { ThemeProvider } from '@/app/ThemeProvider'
import { AppShell } from '@/app/layout/AppShell'
import { Route, Routes } from 'react-router-dom'

function renderNav() {
  return render(
    <LibraryProvider>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<h1>Home</h1>} />
              <Route path="/search" element={<h1>Search</h1>} />
              <Route path="/movies" element={<h1>Movies</h1>} />
              <Route path="/library" element={<h1>Library</h1>} />
              <Route path="/favorites" element={<h1>Favorites</h1>} />
              <Route path="/settings" element={<h1>Settings</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </LibraryProvider>,
  )
}

describe('responsive navigation', () => {
  it('moves between primary routes from the sidebar', async () => {
    const user = userEvent.setup()
    renderNav()
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: 'Search' })[0]!)
    expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: 'Library' })[0]!)
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument()
  })
})
