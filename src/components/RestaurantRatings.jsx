import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatRating(rating) {
  if (rating == null) return '—'
  return Number(rating).toFixed(1)
}

function formatFetchedAt(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function RestaurantRatings() {
  const [ratings, setRatings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ restaurant_name: '', min_rating: '' })

  useEffect(() => {
    fetchRatings()
  }, [])

  async function fetchRatings() {
    setLoading(true)
    const { data, error } = await supabase
      .from('restaurant_ratings')
      .select('*')
      .order('fetched_at', { ascending: false })

    if (error) {
      console.error('Fetch error:', error)
    } else {
      setRatings(data ?? [])
    }
    setLoading(false)
  }

  const filteredRatings = ratings.filter(row => {
    if (
      filters.restaurant_name &&
      !row.restaurant_name?.toLowerCase().includes(filters.restaurant_name.toLowerCase())
    ) {
      return false
    }
    if (filters.min_rating !== '') {
      const minRating = Number(filters.min_rating)
      if (row.google_rating == null || Number(row.google_rating) < minRating) {
        return false
      }
    }
    return true
  })

  return (
    <section className="table-section">
      <h2>Restaurant Ratings</h2>

      <div className="filters-container">
        <input
          type="text"
          placeholder="Filter by Restaurant Name"
          value={filters.restaurant_name}
          onChange={e => setFilters({ ...filters, restaurant_name: e.target.value })}
        />
        <input
          type="number"
          step="0.1"
          min="0"
          max="5"
          placeholder="Min Rating"
          value={filters.min_rating}
          onChange={e => setFilters({ ...filters, min_rating: e.target.value })}
        />
      </div>

      {loading ? (
        <p className="loading-text">Loading...</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Restaurant Name</th>
                <th>Google Rating</th>
                <th>Review Count</th>
                <th>Fetched At</th>
              </tr>
            </thead>
            <tbody>
              {filteredRatings.map(row => (
                <tr key={row.id}>
                  <td>{row.restaurant_name}</td>
                  <td>{formatRating(row.google_rating)}</td>
                  <td>{row.google_review_count ?? '—'}</td>
                  <td>{formatFetchedAt(row.fetched_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ratings.length > 0 && filteredRatings.length === 0 && (
            <p className="empty-text">No matching ratings found.</p>
          )}
        </div>
      )}
    </section>
  )
}
