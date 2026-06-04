import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { NavList } from './Sidebar'
import { Logo } from './Logo'
import { PixelButton } from './ui'

export function TopBar({ onOpenUsers }) {
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b-2 border-line bg-bg/85 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          {/* burger — mobile/tablet only */}
          <button
            className="lg:hidden pixel-btn-ghost pixel-btn !px-2.5 !py-2"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Меню"
          >
            <span className="text-base leading-none">{menuOpen ? '✕' : '☰'}</span>
          </button>
          <div className="lg:hidden">
            <Logo height={28} />
          </div>
          <span className="label hidden lg:block">Панель управления Theos</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="label hidden sm:block max-w-[200px] truncate">{user?.email}</span>
          <PixelButton variant="crystal" className="!px-3 !py-2" onClick={onOpenUsers}>
            Юзеры
          </PixelButton>
          <PixelButton variant="ghost" className="!px-3 !py-2" onClick={signOut}>
            Выход
          </PixelButton>
        </div>
      </header>

      {/* mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-bgDeep/70" />
          <div
            className="absolute left-0 top-0 h-full w-[260px] border-r-2 border-gold bg-bg px-4 py-6 flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <Logo height={36} />
            <NavList onNavigate={() => setMenuOpen(false)} />
            <div className="mt-auto">
              <span className="label">{user?.email}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
