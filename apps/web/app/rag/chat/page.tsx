'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send, Bot, User, FileText, Clock, Zap } from 'lucide-react'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: Array<{
    contractId: string
    title?: string
    excerpt: string
    relevance: number
  }>
  confidence?: number
  processingTime?: number
}

interface RAGStats {
  totalQueries: number
  avgConfidence: number
  avgProcessingTime: number
  totalSources: number
}

export default function RAGChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState<RAGStats>({
    totalQueries: 0,
    avgConfidence: 0,
    avgProcessingTime: 0,
    totalSources: 0
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: userMessage.content,
          tenantId: 'demo-tenant',
          options: {
            maxResults: 5
          }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        sources: data.sources,
        confidence: data.confidence,
        processingTime: data.processingTime
      }

      setMessages(prev => [...prev, assistantMessage])

      setStats(prev => {
        const newTotal = prev.totalQueries + 1
        return {
          totalQueries: newTotal,
          avgConfidence: (prev.avgConfidence * prev.totalQueries + data.confidence) / newTotal,
          avgProcessingTime: (prev.avgProcessingTime * prev.totalQueries + data.processingTime) / newTotal,
          totalSources: prev.totalSources + (data.sources?.length || 0)
        }
      })

    } catch (error) {
      console.error('Error querying RAG:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your query. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const clearChat = () => {
    setMessages([])
    setStats({
      totalQueries: 0,
      avgConfidence: 0,
      avgProcessingTime: 0,
      totalSources: 0
    })
  }

  const exampleQueries = [
    "What are the payment terms in our contracts?",
    "Show me contracts with termination clauses",
    "Which contracts have the highest risk levels?",
    "What are the renewal dates for active contracts?",
    "Find contracts with force majeure clauses"
  ]

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card className="h-[800px] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                RAG Chat Assistant
              </CardTitle>
              <Button variant="outline" size="sm" onClick={clearChat}>
                Clear Chat
              </Button>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0">
              <div className="flex-1 p-4 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Welcome to RAG Chat</h3>
                    <p className="mb-4">Ask questions about your contracts using natural language.</p>
                    <div className="text-sm space-y-1">
                      <p className="font-medium">Try asking:</p>
                      {exampleQueries.slice(0, 3).map((query, index) => (
                        <p key={index} className="text-muted-foreground italic">&quot;{query}&quot;</p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div key={message.id} className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-3 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            {message.type === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                          </div>
                          
                          <div className="space-y-2">
                            <div className={`rounded-lg p-3 ${message.type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            </div>
                            
                            {message.type === 'assistant' && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {message.confidence && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Zap className="h-3 w-3 mr-1" />
                                      {(message.confidence * 100).toFixed(0)}% confidence
                                    </Badge>
                                  )}
                                  {message.processingTime && (
                                    <Badge variant="outline" className="text-xs">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {message.processingTime}ms
                                    </Badge>
                                  )}
                                </div>
                                
                                {message.sources && message.sources.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground">Sources:</p>
                                    <div className="space-y-1">
                                      {message.sources.map((source, index) => (
                                        <div key={index} className="bg-background border rounded p-2 text-xs">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium flex items-center gap-1">
                                              <FileText className="h-3 w-3" />
                                              {source.title || source.contractId}
                                            </span>
                                            <Badge variant="outline" className="text-xs">
                                              {(source.relevance * 100).toFixed(0)}%
                                            </Badge>
                                          </div>
                                          <p className="text-muted-foreground">{source.excerpt}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="bg-muted rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">Thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <div className="border-t p-4">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question about your contracts..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isLoading || !input.trim()}>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Session Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Queries:</span>
                <span className="font-medium">{stats.totalQueries}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg Confidence:</span>
                <span className="font-medium">{(stats.avgConfidence * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg Time:</span>
                <span className="font-medium">{Math.round(stats.avgProcessingTime)}ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sources Found:</span>
                <span className="font-medium">{stats.totalSources}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Example Queries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {exampleQueries.map((query, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="w-full text-left justify-start h-auto p-2 text-xs"
                  onClick={() => setInput(query)}
                  disabled={isLoading}
                >
                  {query}
                </Button>
              ))}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>RAG Service</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Vector Database</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>OpenAI API</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
