import { supabase } from '../lib/supabase'

export default function AppLayout({ session, activeTab, onTabChange, children }) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🍽️ Restaurant Verifications</h1>
        <div className="header-right">
          <span className="user-email">{session.user.email}</span>
          <button className="logout-btn" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <nav className="tab-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => onTabChange('orders')}
        >
          Orders
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'ratings' ? 'active' : ''}`}
          onClick={() => onTabChange('ratings')}
        >
          Restaurant Ratings
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => onTabChange('reviews')}
        >
          Order Reviews
        </button>
      </nav>

      {children}
    </div>
  )
}
