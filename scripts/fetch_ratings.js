import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

async function getPendingRatingRows() {
  const { data, error } = await supabaseAdmin
    .from('restaurant_ratings')
    .select('id, restaurant_name')
    .eq('google_api_sent', false)
    .order('restaurant_name')

  if (error) {
    throw new Error(`Failed to fetch pending restaurant ratings: ${error.message}`)
  }

  return data ?? []
}

async function fetchGooglePlace(restaurantName) {
  const input = encodeURIComponent(`${restaurantName} Rome`)
  const url =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${input}` +
    `&inputtype=textquery` +
    `&fields=name,rating,user_ratings_total` +
    `&key=${GOOGLE_PLACES_API_KEY}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Google Places API HTTP ${response.status}`)
  }

  return response.json()
}

async function updateRatingRow({ id, restaurantName, googleRating, googleReviewCount }) {
  const { error } = await supabaseAdmin
    .from('restaurant_ratings')
    .update({
      google_rating: googleRating,
      google_review_count: googleReviewCount,
      fetched_at: new Date().toISOString(),
      google_api_sent: true,
    })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to update rating for ${restaurantName}: ${error.message}`)
  }
}

async function main() {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('Missing GOOGLE_PLACES_API_KEY in .env')
  }
  if (!process.env.VITE_SUPABASE_URL) {
    throw new Error('Missing VITE_SUPABASE_URL in .env')
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env')
  }

  const pendingRows = await getPendingRatingRows()
  console.log(`Found ${pendingRows.length} restaurant(s) pending Google API fetch.`)

  let updated = 0
  let skipped = 0

  for (const row of pendingRows) {
    const restaurantName = row.restaurant_name
    try {
      const result = await fetchGooglePlace(restaurantName)

      if (result.status !== 'OK' || !result.candidates?.length) {
        console.warn(`Warning: No Google result for "${restaurantName}" (status: ${result.status ?? 'unknown'})`)
        skipped += 1
        continue
      }

      const place = result.candidates[0]
      if (place.rating == null) {
        console.warn(`Warning: No rating for "${restaurantName}" — skipping`)
        skipped += 1
        continue
      }

      await updateRatingRow({
        id: row.id,
        restaurantName,
        googleRating: place.rating,
        googleReviewCount: place.user_ratings_total ?? null,
      })

      updated += 1
      const reviewCount = place.user_ratings_total ?? 0
      console.log(`${restaurantName} → ${Number(place.rating).toFixed(1)} ⭐ (${reviewCount} reviews)`)
    } catch (error) {
      console.warn(`Warning: Failed to process "${restaurantName}": ${error.message}`)
      skipped += 1
    }
  }

  console.log(`Done. ${updated} restaurants updated, ${skipped} skipped.`)
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
