import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const GROQ_API_KEY = process.env.GROQ_API_KEY

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getPendingOrders() {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, order_id, restaurant_name, restaurant_desc, date, time')
    .eq('status', 'pending')
    .order('created_at')

  if (error) {
    throw new Error(`Failed to fetch pending orders: ${error.message}`)
  }

  return data ?? []
}

async function getRestaurantRating(restaurantName) {
  const { data, error } = await supabaseAdmin
    .from('restaurant_ratings')
    .select('id, google_rating, google_review_count')
    .eq('restaurant_name', restaurantName)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch rating for ${restaurantName}: ${error.message}`)
  }

  if (!data || data.google_rating == null) {
    return null
  }

  return data
}

function buildOrderDateTime(date, time) {
  if (!date) return null
  const timePart = time ? String(time).slice(0, 8) : '00:00:00'
  return `${date}T${timePart}`
}

async function insertOrderReview({
  order,
  status,
  description,
  rating,
}) {
  if (order.order_id == null) {
    console.warn(`Skipping order_reviews insert for ${order.restaurant_name}: missing order_id`)
    return
  }

  const { error } = await supabaseAdmin.from('order_reviews').insert({
    order_id: order.order_id,
    restaurant_id: rating?.id ?? null,
    restaurant_name: order.restaurant_name,
    status,
    description,
    google_rating: rating?.google_rating ?? null,
    google_review_count: rating?.google_review_count ?? null,
    order_date_time: buildOrderDateTime(order.date, order.time),
  })

  if (error) {
    throw new Error(`Failed to insert order review for ${order.restaurant_name}: ${error.message}`)
  }
}

function buildGeminiPrompt(order, rating) {
  return `You are a travel agent verifying restaurant recommendations for elderly guests (80 years old) traveling in Rome. 
Evaluate this restaurant based on its Google data and decide if it should be approved or declined.

Restaurant: ${order.restaurant_name}
Google Rating: ${rating.google_rating}
Number of Reviews: ${rating.google_review_count}
Description: ${order.restaurant_desc ?? 'No description provided'}

Rules:
- VERIFIED: rating >= 4.0 AND reviews >= 500
- FAILED: rating < 3.8
- NEEDS_REVIEW: anything in between or borderline cases

Respond in this exact JSON format only, no extra text:
{
  "status": "verified" or "failed" or "needs_review",
  "notes": "2-3 sentence explanation of your decision mentioning the rating, review count, and any relevant observations"
}`
}

async function callGroq(prompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    throw new Error(`Groq API HTTP ${response.status}`)
  }

  const result = await response.json()
  const text = result.choices?.[0]?.message?.content

  if (!text) {
    throw new Error('Groq returned empty response')
  }

  return text
}

function parseGeminiResponse(text) {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const parsed = JSON.parse(cleaned)

  const status = parsed.status?.toLowerCase()
  if (!['verified', 'failed', 'needs_review'].includes(status)) {
    throw new Error(`Invalid status from Groq: ${parsed.status}`)
  }

  if (!parsed.notes) {
    throw new Error('Missing notes from Groq response')
  }

  return { status, notes: parsed.notes }
}

async function updateOrder({ id, status, notes }) {
  const { error } = await supabaseAdmin
    .from('orders')
    .update({
      status,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to update order ${id}: ${error.message}`)
  }
}

function logResult({ restaurantName, status, googleRating, googleReviewCount }) {
  const rating = googleRating != null ? Number(googleRating).toFixed(1) : '—'
  const reviews = googleReviewCount ?? 0
  const detail = `(${rating} ⭐, ${reviews} reviews)`

  if (status === 'verified') {
    console.log(`✅ ${restaurantName} → verified ${detail}`)
  } else if (status === 'failed') {
    console.log(`❌ ${restaurantName} → failed ${detail}`)
  } else {
    console.log(`⚠️ ${restaurantName} → needs_review ${detail}`)
  }
}

async function processOrder(order, counts) {
  const rating = await getRestaurantRating(order.restaurant_name)

  if (!rating) {
    const status = 'needs_review'
    const notes = 'Restaurant not found in ratings table. Manual review required.'

    await updateOrder({
      id: order.id,
      status,
      notes,
    })
    await insertOrderReview({ order, status, description: notes, rating: null })
    counts.needs_review += 1
    console.log(`⚠️ ${order.restaurant_name} → needs_review (no rating found)`)
    return
  }

  try {
    const prompt = buildGeminiPrompt(order, rating)
    const groqText = await callGroq(prompt)
    const { status, notes } = parseGeminiResponse(groqText)

    await updateOrder({ id: order.id, status, notes })
    await insertOrderReview({ order, status, description: notes, rating })
    counts[status] += 1
    logResult({
      restaurantName: order.restaurant_name,
      status,
      googleRating: rating.google_rating,
      googleReviewCount: rating.google_review_count,
    })
  } catch (error) {
    console.warn(`Warning: Groq evaluation failed for "${order.restaurant_name}": ${error.message}`)
    const status = 'needs_review'
    const notes = 'AI evaluation failed. Manual review required.'

    await updateOrder({
      id: order.id,
      status,
      notes,
    })
    await insertOrderReview({ order, status, description: notes, rating })
    counts.needs_review += 1
    logResult({
      restaurantName: order.restaurant_name,
      status,
      googleRating: rating.google_rating,
      googleReviewCount: rating.google_review_count,
    })
  }
}

async function main() {
  if (!process.env.VITE_SUPABASE_URL) {
    throw new Error('Missing VITE_SUPABASE_URL in .env')
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env')
  }
  if (!GROQ_API_KEY) {
    throw new Error('Missing GROQ_API_KEY in .env')
  }

  const pendingOrders = await getPendingOrders()
  console.log(`Found ${pendingOrders.length} pending order(s).`)

  const counts = { verified: 0, failed: 0, needs_review: 0 }

  for (const order of pendingOrders) {
    await processOrder(order, counts)
    await sleep(300)
  }

  console.log(
    `Done. ${counts.verified} verified, ${counts.failed} failed, ${counts.needs_review} needs_review.`
  )
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
