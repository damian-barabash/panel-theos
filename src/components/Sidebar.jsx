import { NavLink } from 'react-router-dom'
import { Logo } from './Logo'

// Nav items are config-driven — add a route here to grow the menu.
export const NAV = [
  { to: '/logs', label: 'Логи', icon: '▤' },
  { to: '/prompts', label: 'Промт-мастер', icon: '✦' },
  { to: '/chym', label: 'Chym Writer', icon: '✎' },
  { to: '/pets-food', label: 'Животные и еда', icon: '◆' },
  { to: '/settings', label: 'Обновления', icon: '⚙' },
]

export function NavList({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-1.5">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
        >
          <span className="text-gold text-sm leading-none">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

// Desktop sidebar (lg+)
export function Sidebar() {
  return (
    <aside className="hidden lg:flex w-[232px] shrink-0 flex-col gap-6 border-r-2 border-line bg-bgDeep/50 px-4 py-6">
      <div className="px-1">
        <Logo height={40} />
      </div>
      <NavList />
      <div className="mt-auto px-1">
        <span className="label">Theos · Мир</span>
      </div>
    </aside>
  )
}
