import { createClient } from '@supabase/supabase-js'

// Same backend as the Theos game (project APP_SERWER). Publishable key is
// meant to be public — RLS + the is_panel_admin() gate protect panel data.
export const SUPABASE_URL = 'https://pizesoiespyepoftrrop.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_Me633LD5KFxJ5fCr67gZUw_Okigw0tR'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // Distinct storage key so the panel session never collides with anything
    // the game might store in the same browser.
    storageKey: 'theos-panel-auth',
  },
})
