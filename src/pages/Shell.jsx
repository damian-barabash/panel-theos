import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { TopBar } from '../components/TopBar'
import { UserModal } from '../components/UserModal'

export default function Shell() {
  const [usersOpen, setUsersOpen] = useState(false)
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenUsers={() => setUsersOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      {usersOpen && <UserModal onClose={() => setUsersOpen(false)} />}
    </div>
  )
}
