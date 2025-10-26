'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const [emailCount, setEmailCount] = useState(15)
  const [emails, setEmails] = useState([
    {
      id: 1,
      sender: 'Emily Davis',
      content: 'Hi Emily, Thanks for your order. We are pleased to inform you that your order has been shipped. You can...'
    },
    {
      id: 2,
      sender: 'Marketing Team',
      content: 'Dear valued customer, we are excited to introduce our latest product! Check it out on our website now.'
    },
    {
      id: 3,
      sender: 'Support Team',
      content: 'Hello, we have important updates regarding your account security. Please review the changes in your dashboard.'
    }
  ])
  const [loading, setLoading] = useState({})
  const [classifications, setClassifications] = useState({})
  const [displayedEmails, setDisplayedEmails] = useState(emails)
  // Add a fetching state for Gmail API
  const [fetching, setFetching] = useState(false)
  // State for viewing email details
  const [selectedEmailId, setSelectedEmailId] = useState<string | number | null>(null)
  const [emailDetails, setEmailDetails] = useState<any | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  // Check if user is authenticated
  if (status === 'unauthenticated') {
    redirect('/')
  }

  // Update displayed emails when emailCount changes
  useEffect(() => {
    setDisplayedEmails(emails.slice(0, emailCount > emails.length ? emails.length : emailCount))
  }, [emailCount, emails])

  // Fetch emails from Gmail API when authenticated and count changes
  useEffect(() => {
    if (status !== 'authenticated') return
    const controller = new AbortController()
    setFetching(true)
    fetch(`/api/gmail?count=${emailCount}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || 'Failed to fetch Gmail emails')
        }
        return res.json()
      })
      .then((data) => {
        const emailsData = Array.isArray(data?.emails) ? data.emails : []
        setEmails(emailsData)
        try {
          localStorage.setItem('emails', JSON.stringify(emailsData))
        } catch {}
      })
      .catch((err) => {
        console.error('Gmail fetch error:', err)
        try {
          const saved = localStorage.getItem('emails')
          if (saved) {
            setEmails(JSON.parse(saved))
          }
        } catch {}
      })
      .finally(() => setFetching(false))

    return () => controller.abort()
  }, [emailCount, status])

  const handleClassify = async (emailId) => {
    setLoading(prev => ({ ...prev, [emailId]: true }))
    try {
      const email = displayedEmails.find(e => e.id === emailId)
      const openaiKey = typeof window !== 'undefined' ? localStorage.getItem('openai_api_key') : ''
      const response = await fetch('/api/classify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: email?.content || '', openaiKey }),
      })
      if (!response.ok) {
        throw new Error('Classification failed')
      }
      const result = await response.json()
      setClassifications(prev => ({
        ...prev,
        [emailId]: {
          category: result.category,
          confidence: result.confidence,
          source: result.source || 'openai'
        }
      }))
    } catch (error) {
      console.error('Error classifying email:', error)
    } finally {
      setLoading(prev => ({ ...prev, [emailId]: false }))
    }
  }

  const handleLogout = () => {
    signOut({ callbackUrl: '/' })
  }

  const openEmail = async (id: string | number) => {
    setSelectedEmailId(id)
    setDetailsLoading(true)
    try {
      const res = await fetch(`/api/gmail?id=${id}`)
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to fetch email')
      }
      const data = await res.json()
      setEmailDetails(data.email)
    } catch (e) {
      console.error('Email details error:', e)
      // Fallback to existing list item if API fails
      const fallback = displayedEmails.find(e => e.id === id)
      setEmailDetails(fallback || null)
    } finally {
      setDetailsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-4xl mx-auto border border-gray-300 rounded-lg p-8">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div>
              <h1 className="font-bold text-black">{session?.user?.name || session?.user?.email || 'User'}</h1>
              <p className="text-sm text-black">{session?.user?.email || ''}</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="text-black hover:underline"
          >
            Login/Logout
          </button>
        </header>
        
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center">
            <select 
              value={emailCount}
              onChange={(e) => setEmailCount(Number(e.target.value))}
              className="border border-gray-300 rounded p-1 text-black"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>
          
          <button
            onClick={() => displayedEmails.forEach(email => handleClassify(email.id))}
            className="bg-blue-500 text-black px-4 py-1 rounded hover:bg-blue-600"
          >
            Classify
          </button>
        </div>
        
        {/* Show fetching state for Gmail */}
        {fetching && (
          <div className="mb-4 text-center">
            <p className="text-black">Fetching Gmail...</p>
          </div>
        )}
        
        <div className="space-y-6">
          {displayedEmails.map((email) => (
            <div 
              key={email.id} 
              className="border border-gray-300 rounded-md p-6 cursor-pointer hover:bg-gray-50"
              onClick={() => openEmail(email.id)}
            >
              <div className="flex justify-between mb-4">
                <h3 className="font-bold text-black">{email.sender}</h3>
                {classifications[email.id] && (
                  <div className={`font-medium ${
                    classifications[email.id].category === 'Important' ? 'text-green-600' : 
                    classifications[email.id].category === 'Promotions' ? 'text-yellow-600' : 
                    classifications[email.id].category === 'Social' ? 'text-blue-600' : 
                    classifications[email.id].category === 'Marketing' ? 'text-purple-600' : 
                    classifications[email.id].category === 'Spam' ? 'text-red-600' : 
                    'text-gray-600'
                  }`}>
                    {classifications[email.id].category} ({classifications[email.id].confidence}%)
                  </div>
                )}
              </div>
              <p className="text-black">{email.content}</p>
              
              {loading[email.id] && (
                <div className="mt-4 text-center">
                  <p className="text-black">Classifying...</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedEmailId && (
          <div className="mt-8 border border-gray-300 rounded-md p-6 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-black">{emailDetails?.subject || 'Email Details'}</h3>
                <p className="text-sm text-black">{emailDetails?.sender || ''}</p>
              </div>
              <button 
                className="text-black hover:underline" 
                onClick={() => { setSelectedEmailId(null); setEmailDetails(null) }}
              >
                Close
              </button>
            </div>
            {detailsLoading ? (
              <p className="mt-4 text-black">Loading...</p>
            ) : (
              <div className="mt-4 text-black whitespace-pre-wrap">
                {emailDetails?.content || ''}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}