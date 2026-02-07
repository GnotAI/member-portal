import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import AdminPortal from './components/AdminPortal'
import { Loader2 } from 'lucide-react'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else {
        setUserRole(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        // If profile doesn't exist yet, it's fine, default to client logic or wait
        console.error('Error fetching profile:', error)
      }

      if (data) {
        setUserRole(data.role)
      } else {
        // Handle case where profile isn't created trigger-side yet
        // For now, assume client
        setUserRole('client')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 size={48} className="animate-spin text-muted" />
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className="container">
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '3rem',
        padding: '1rem 0',
        borderBottom: '1px solid var(--border-glass)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent-primary), #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '1.2rem'
          }}>
            P
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: '700' }}>Portal</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="text-muted" style={{ fontSize: '0.9rem' }}>{session.user.email}</span>
          <button
            className="btn btn-outline"
            onClick={() => supabase.auth.signOut()}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="animate-fade-in">
        {userRole === 'admin' ? (
          <AdminPortal session={session} />
        ) : (
          <Dashboard session={session} />
        )}
      </main>
    </div>
  )
}

export default App
