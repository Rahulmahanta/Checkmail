import { NextResponse } from 'next/server'

// Allowed categories per requirements
const categories = ['Important', 'Promotions', 'Social', 'Marketing', 'Spam', 'General'] as const

type Category = typeof categories[number]

function normalizeCategory(raw: string): Category {
  const s = raw.toLowerCase()
  if (s.includes('important')) return 'Important'
  if (s.includes('promotion') || s.includes('promotional')) return 'Promotions'
  if (s.includes('social')) return 'Social'
  if (s.includes('marketing') || s.includes('newsletter')) return 'Marketing'
  if (s.includes('spam') || s.includes('junk')) return 'Spam'
  return 'General'
}

export async function POST(request: Request) {
  try {
    const { content, openaiKey } = await request.json()

    if (!content) {
      return NextResponse.json({ error: 'Email content is required' }, { status: 400 })
    }

    // Prefer user-provided key from localStorage (sent by client), else env
    const apiKey = openaiKey || process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.warn('OpenAI API key not found, falling back to keyword-based classification')
      return keywordBasedClassification(content)
    }

    try {
      // Call OpenAI Chat Completions with GPT-4o (or mini for lower cost)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are an email classifier. Classify the email into ONE of these categories exactly: Important, Promotions, Social, Marketing, Spam, General. Return ONLY valid JSON with keys: category (string), confidence (integer 70-99).'
            },
            {
              role: 'user',
              content: `Classify this email: ${content}`
            }
          ],
          temperature: 0.2,
          max_tokens: 50
        })
      })

      if (!response.ok) {
        const errorData = await safeJson(response)
        console.error('OpenAI API error:', errorData)
        return keywordBasedClassification(content)
      }

      const data = await response.json()
      const raw = data?.choices?.[0]?.message?.content || ''

      let category: Category = 'General'
      let confidence = 75

      // Try JSON parse first
      try {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.category) {
          category = normalizeCategory(String(parsed.category))
        } else {
          category = normalizeCategory(raw)
        }
        if (parsed && parsed.confidence) {
          const c = Number(parsed.confidence)
          confidence = Number.isFinite(c) ? Math.min(Math.max(Math.round(c), 70), 99) : confidence
        }
      } catch {
        // If not JSON, attempt to infer from text
        category = normalizeCategory(raw)
        const m = raw.match(/\b(\d{2})\b/)
        if (m) {
          const c = parseInt(m[1], 10)
          confidence = Math.min(Math.max(c, 70), 99)
        }
      }

      return NextResponse.json({
        category,
        confidence,
        source: 'openai'
      })

    } catch (error) {
      console.error('OpenAI API error:', error)
      return keywordBasedClassification(content)
    }
  } catch (error) {
    console.error('Classification error:', error)
    return NextResponse.json({ error: 'Failed to classify email' }, { status: 500 })
  }
}

async function safeJson(res: Response) {
  try { return await res.json() } catch { return await res.text() }
}

// Fallback to keyword-based classification if OpenAI API fails or key missing
function keywordBasedClassification(content: string) {
  const lc = content.toLowerCase()
  let category: Category = 'General'

  if (lc.includes('meeting') || lc.includes('invoice') || lc.includes('project') || lc.includes('deadline') || lc.includes('review')) {
    category = 'Important'
  } else if (lc.includes('sale') || lc.includes('discount') || lc.includes('offer') || lc.includes('deal')) {
    category = 'Promotions'
  } else if (lc.includes('facebook') || lc.includes('twitter') || lc.includes('instagram') || lc.includes('friend') || lc.includes('family')) {
    category = 'Social'
  } else if (lc.includes('newsletter') || lc.includes('marketing') || lc.includes('update')) {
    category = 'Marketing'
  } else if (lc.includes('unsubscribe') || lc.includes('win money') || lc.includes('lottery') || lc.includes('click here')) {
    category = 'Spam'
  }

  return NextResponse.json({
    category,
    confidence: Math.floor(Math.random() * 30) + 70,
    source: 'keyword'
  })
}