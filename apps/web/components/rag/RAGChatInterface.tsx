'use client'

import { useState } from 'react'
import { Card } from '../ui/enhanced-card'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{
    contractId: string
    title?: string
    excerpt: string
    relevance: number
  }>
  confidence?: number
}

export function RAGChatInterface({ tenantId }: { tenantId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = {
      role: 'user',
      content: input
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: input,
          tenantId
        })
      })

      const data = await response.json()

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        confidence: data.confidence
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your query. Please try again.'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[600px] max-w-4xl mx-auto">
      <Card className="flex-1 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Contract Intelligence Assistant</h2>
          <p className="text-sm text-gray-600">Ask questions about your contracts</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <p className="text-lg mb-4">👋 Hi! I can help you with your contracts.</p>
              <p className="text-sm">Try asking:</p>
              <ul className="text-sm mt-2 space-y-1">
                <li>"What are the payment terms?"</li>
                <li>"Show me contracts expiring soon"</li>
                <li>"Which contracts have auto-renewal?"</li>
                <li>"Compare rates across suppliers"</li>
              </ul>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>

                {message.confidence && (
                  <div className="mt-2 text-xs opacity-75">
                    Confidence: {(message.confidence * 100).toFixed(0)}%
                  </div>
                )}

                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-xs font-semibold mb-2">Sources:</p>
                    {message.sources.map((source, idx) => (
                      <div key={idx} className="text-xs mb-2 p-2 bg-white rounded">
                        <div className="font-medium">{source.title || source.contractId}</div>
                        <div className="text-gray-600 mt-1">{source.excerpt}</div>
                        <div className="text-gray-500 mt-1">
                          Relevance: {(source.relevance * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div className="animate-pulse">Thinking...</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t">
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your contracts..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
