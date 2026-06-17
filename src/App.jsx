import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import AppLayout from './components/AppLayout'
import Dashboard from './components/Dashboard'
import RestaurantRatings from './components/RestaurantRatings'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('orders')

  useEffect(() => {
    // Get the current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="loading-screen">Loading...</div>
  }

  return session ? (
    <AppLayout session={session} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'orders' ? <Dashboard /> : <RestaurantRatings />}
    </AppLayout>
  ) : (
    <Login />
  )
}

export default App
