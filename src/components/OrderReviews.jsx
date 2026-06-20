import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatRating(rating) {
  if (rating == null) return '—'
  return Number(rating).toFixed(1)
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function statusBadge(status) {
  const colors = {
    verified: '#10b981',
    failed: '#ef4444',
    needs_review: '#f59e0b',
  }
  const label = status?.replace(/_/g, ' ') ?? '—'
  return (
    <span className="status-badge" style={{ backgroundColor: colors[status] || '#6b7280' }}>
      {label}
    </span>
  )
}

export default function OrderReviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ order_id: '', restaurant_name: '', status: '' })

  useEffect(() => {
    fetchReviews()
  }, [])

  async function fetchReviews() {
    setLoading(true)
    const { data, error } = await supabase
      .from('order_reviews')
      .select('*')
      .order('order_date_time', { ascending: true })

    if (error) {
      console.error('Fetch error:', error)
    } else {
      setReviews(data ?? [])
    }
    setLoading(false)
  }

  const filteredReviews = reviews.filter(row => {
    if (filters.order_id && String(row.order_id) !== filters.order_id) return false
    if (
      filters.restaurant_name &&
      !row.restaurant_name?.toLowerCase().includes(filters.restaurant_name.toLowerCase())
    ) {
      return false
    }
    if (filters.status && row.status !== filters.status) return false
    return true
  })

  return (
    <section className="table-section">
      <h2>Order Reviews</h2>

      <div className="filters-container">
        <input
          type="number"
          placeholder="Filter by Order ID"
          value={filters.order_id}
          onChange={e => setFilters({ ...filters, order_id: e.target.value })}
        />
        <input
          type="text"
          placeholder="Filter by Restaurant Name"
          value={filters.restaurant_name}
          onChange={e => setFilters({ ...filters, restaurant_name: e.target.value })}
        />
        <select
          value={filters.status}
          onChange={e => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All</option>
          <option value="verified">Verified</option>
          <option value="failed">Failed</option>
          <option value="needs_review">Needs Review</option>
        </select>
      </div>

      {loading ? (
        <p className="loading-text">Loading...</p>
      ) : reviews.length === 0 ? (
        <p className="empty-text">No reviews yet.</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Restaurant Name</th>
                <th>Status</th>
                <th>Description</th>
                <th>Google Rating</th>
                <th>Review Count</th>
                <th>Order Date/Time</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.map(row => (
                <tr key={row.review_id}>
                  <td>{row.order_id ?? '—'}</td>
                  <td>{row.restaurant_name}</td>
                  <td>{statusBadge(row.status)}</td>
                  <td>{row.description ?? '—'}</td>
                  <td>{formatRating(row.google_rating)}</td>
                  <td>{row.google_review_count ?? '—'}</td>
                  <td>{formatDateTime(row.order_date_time)}</td>
                  <td>{formatDateTime(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredReviews.length === 0 && (
            <p className="empty-text">No matching reviews found.</p>
          )}
        </div>
      )}
    </section>
  )
}
