import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [admin, setAdmin] = useState(null) // row from panel_admins (gate)
  const [loading, setLoading] = useState(true)

  // A signed-in user only counts as a panel user if they have a panel_admins row.
  const loadAdmin = useCallback(async (userId) => {
    if (!userId) {
      setAdmin(null)
      return
    }
    const { data } = await supabase
      .from('panel_admins')
      .select('id, email, created_at')
      .eq('id', userId)
      .maybeSingle()
    setAdmin(data ?? null)
  }, [])

  useEffect(() => {
    let active = true
    const safety = setTimeout(() => active && setLoading(false), 8000)

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        return loadAdmin(data.session?.user?.id)
      })
      .finally(() => {
        if (active) {
          clearTimeout(safety)
          setLoading(false)
        }
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      // Do NOT await Supabase calls inside this callback (auth lock deadlock).
      setSession(sess)
      setTimeout(() => {
        if (active) loadAdmin(sess?.user?.id)
      }, 0)
    })

    return () => {
      active = false
      clearTimeout(safety)
      sub.subscription.unsubscribe()
    }
  }, [loadAdmin])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    return error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setAdmin(null)
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    admin,
    hasAccess: !!admin,
    loading,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
