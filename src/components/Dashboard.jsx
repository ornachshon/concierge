import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard({ session }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ order_id: '', time: '', user_name: '', restaurant_name: '' })
  const [manualApprovals, setManualApprovals] = useState({})

  async function handleManualApproval(id, status) {
    const previousStatus = manualApprovals[id]

    setManualApprovals(prev => ({ ...prev, [id]: status }))
    setOrders(prev =>
      prev.map(order =>
        order.id === id ? { ...order, manual_approval: status } : order
      )
    )

    const { data, error } = await supabase
      .from('orders')
      .update({ manual_approval: status })
      .eq('id', id)
      .select('id, manual_approval')
      .single()

    if (error || !data) {
      console.error('Update error:', error)
      alert('Failed to update approval: ' + (error?.message ?? 'No row updated'))
      setManualApprovals(prev => ({ ...prev, [id]: previousStatus }))
      fetchOrders()
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*')

    if (error) {
      console.error('Fetch error:', error)
    } else {
      setOrders(data)
      // Initialize the manualApprovals state from the DB data
      const initialApprovals = {}
      data.forEach(order => {
        if (order.manual_approval) {
          initialApprovals[order.id] = order.manual_approval
        }
      })
      setManualApprovals(initialApprovals)
    }
    setLoading(false)
  }



  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function statusBadge(status) {
    const colors = {
      pending: '#f59e0b',
      verified: '#10b981',
      rejected: '#ef4444',
    }
    return (
      <span className="status-badge" style={{ backgroundColor: colors[status] || '#6b7280' }}>
        {status}
      </span>
    )
  }

  const sortedOrders = [...orders].sort((a, b) => {
    if (a.order_id !== b.order_id) {
      // Handle potential null order_ids
      if (a.order_id == null) return 1
      if (b.order_id == null) return -1
      return a.order_id - b.order_id
    }
    const dateA = new Date(a.date).getTime()
    const dateB = new Date(b.date).getTime()
    if (dateA !== dateB) return dateA - dateB

    const timeA = a.time || ''
    const timeB = b.time || ''
    return timeA.localeCompare(timeB)
  })

  const filteredOrders = sortedOrders.filter(o => {
    if (filters.order_id && String(o.order_id) !== filters.order_id) return false
    if (filters.time && !o.time?.includes(filters.time)) return false
    if (filters.user_name && !o.user_name?.toLowerCase().includes(filters.user_name.toLowerCase())) return false
    if (filters.restaurant_name && !o.restaurant_name?.toLowerCase().includes(filters.restaurant_name.toLowerCase())) return false
    return true
  })

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🍽️ Restaurant Verifications</h1>
        <div className="header-right">
          <span className="user-email">{session.user.email}</span>
          <button className="logout-btn" onClick={handleLogout}>Log out</button>
        </div>
      </header>



      <section className="table-section">
        <h2>All Verifications</h2>
        
        <div className="filters-container">
          <input 
            type="number" 
            placeholder="Filter by Order ID" 
            value={filters.order_id} 
            onChange={e => setFilters({ ...filters, order_id: e.target.value })} 
          />
          <input 
            type="text" 
            placeholder="Filter by Time" 
            value={filters.time} 
            onChange={e => setFilters({ ...filters, time: e.target.value })} 
          />
          <input 
            type="text" 
            placeholder="Filter by User Name" 
            value={filters.user_name} 
            onChange={e => setFilters({ ...filters, user_name: e.target.value })} 
          />
          <input 
            type="text" 
            placeholder="Filter by Restaurant" 
            value={filters.restaurant_name} 
            onChange={e => setFilters({ ...filters, restaurant_name: e.target.value })} 
          />
        </div>

        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : filteredOrders.length === 0 ? (
          <p className="empty-text">No verifications found.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Restaurant Name</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Party Size</th>
                  <th>User Name</th>
                  <th>Status</th>
                  <th>Manual Approval</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(row => (
                  <tr key={row.id}>
                    <td>{row.order_id}</td>
                    <td>{row.restaurant_name}</td>
                    <td>{row.date}</td>
                    <td>{row.time}</td>
                    <td>{row.party_size}</td>
                    <td>{row.user_name}</td>
                    <td>{statusBadge(row.status)}</td>
                    <td>
                      <button 
                        className={`action-btn approve-btn ${manualApprovals[row.id] === 'approve' ? 'active' : ''}`}
                        onClick={() => handleManualApproval(row.id, 'approve')}
                      >
                        Approve
                      </button>
                      <button 
                        className={`action-btn decline-btn ${manualApprovals[row.id] === 'decline' ? 'active' : ''}`}
                        onClick={() => handleManualApproval(row.id, 'decline')}
                      >
                        Decline
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
