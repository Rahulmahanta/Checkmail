import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

function decodeBase64Url(data?: string): string {
  if (!data) return ''
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return Buffer.from(b64, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

function extractBodyText(payload: any): { text?: string; html?: string } {
  if (!payload) return {}

  // If body on root
  if (payload.body?.data) {
    const content = decodeBase64Url(payload.body.data)
    // Try to infer type
    if (payload.mimeType === 'text/html') return { html: content }
    return { text: content }
  }

  const parts: any[] = payload.parts || []
  let text: string | undefined
  let html: string | undefined

  const traverse = (p: any) => {
    if (!p) return
    if (p.body?.data) {
      const content = decodeBase64Url(p.body.data)
      if (p.mimeType === 'text/plain' && !text) text = content
      if (p.mimeType === 'text/html' && !html) html = content
    }
    if (Array.isArray(p.parts)) p.parts.forEach(traverse)
  }

  parts.forEach(traverse)
  return { text, html }
}

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.NEXTAUTH_SECRET
    const token = await getToken({ req, secret })

    if (!token || !token.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    // Fetch a single message with full content
    if (id) {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        {
          headers: { Authorization: `Bearer ${token.accessToken}` },
        }
      )

      if (!res.ok) {
        const error = await res.text()
        return NextResponse.json({ error: 'Failed to fetch message', details: error }, { status: 502 })
      }

      const data = await res.json()
      const headers: Array<{ name: string; value: string }> = data.payload?.headers || []
      const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown'
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No subject)'
      const body = extractBodyText(data.payload)
      const content = body.text || body.html || data.snippet || ''

      return NextResponse.json({ email: { id, sender: from, subject, content } })
    }

    // Otherwise list messages (metadata + snippet)
    const countParam = url.searchParams.get('count')
    const count = Math.min(Math.max(parseInt(countParam || '15', 10), 1), 50)

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${count}`,
      {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      }
    )

    if (!listRes.ok) {
      const error = await listRes.text()
      return NextResponse.json({ error: 'Failed to list messages', details: error }, { status: 502 })
    }

    const listData = await listRes.json()
    const messages = listData.messages || []

    const details = await Promise.all(
      messages.map(async (m: { id: string }) => {
        const detailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
          {
            headers: { Authorization: `Bearer ${token.accessToken}` },
          }
        )

        if (!detailRes.ok) {
          return null
        }

        const detailData = await detailRes.json()
        const headers: Array<{ name: string; value: string }> = detailData.payload?.headers || []
        const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown'
        const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No subject)'

        return {
          id: m.id,
          sender: from,
          subject,
          content: detailData.snippet || '',
        }
      })
    )

    const emails = details.filter(Boolean)

    return NextResponse.json({ emails })
  } catch (err) {
    console.error('Gmail API error:', err)
    return NextResponse.json({ error: 'Failed to fetch Gmail messages' }, { status: 500 })
  }
}