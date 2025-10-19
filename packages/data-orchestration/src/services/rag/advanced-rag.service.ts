/**
 * Advanced RAG Service (Phase 4)
 * 
 * Enhanced RAG with streaming, conversation context, and quality controls
 */

import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import pino from 'pino'

const logger = pino({ name: 'advanced-rag-service' })

export interface ConversationContext {
  conversationId: string
  userId: string
  tenantId: string
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>
  metadata: Record<string, any>
}

export interface StreamingResponse {
  conversationId: string
  chunk: string
  isComplete: boolean
  sources?: any[]
  confidence?: number
}

export class AdvancedRAGService {
  private static instance: AdvancedRAGService
  private llm: ChatOpenAI
  private conversations: Map<string, ConversationContext> = new Map()

  private constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4-turbo-preview',
      temperature: 0.1,
      streaming: true,
      openAIApiKey: process.env.OPENAI_API_KEY
    })
  }

  static getInstance(): AdvancedRAGService {
    if (!AdvancedRAGService.instance) {
      AdvancedRAGService.instance = new AdvancedRAGService()
    }
    return AdvancedRAGService.instance
  }

  /**
   * Start or continue a conversation
   */
  async chat(
    conversationId: string,
    message: string,
    userId: string,
    tenantId: string,
    context?: any[]
  ): Promise<{ response: string; sources: any[]; confidence: number }> {
    try {
      // Get or create conversation
      let conversation = this.conversations.get(conversationId)
      if (!conversation) {
        conversation = {
          conversationId,
          userId,
          tenantId,
          messages: [],
          metadata: {}
        }
        this.conversations.set(conversationId, conversation)
      }

      // Build message history
      const messages = [
        new SystemMessage(
          'You are an AI assistant specialized in contract analysis. ' +
          'Provide accurate, concise answers based on the provided context. ' +
          'Always cite your sources and indicate confidence levels.'
        ),
        ...conversation.messages.map(m =>
          m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
        ),
        new HumanMessage(this.buildPromptWithContext(message, context))
      ]

      // Generate response
      const response = await this.llm.invoke(messages)
      const responseText = response.content.toString()

      // Update conversation
      conversation.messages.push(
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: responseText, timestamp: new Date() }
      )

      // Calculate confidence
      const confidence = this.calculateResponseConfidence(responseText, context)

      // Detect hallucinations
      const hallucinationScore = this.detectHallucinations(responseText, context)
      if (hallucinationScore > 0.5) {
        logger.warn({ conversationId, hallucinationScore }, 'Potential hallucination detected')
      }

      return {
        response: responseText,
        sources: context || [],
        confidence
      }
    } catch (error) {
      logger.error({ error, conversationId }, 'Chat failed')
      throw error
    }
  }

  /**
   * Stream a response
   */
  async *streamChat(
    conversationId: string,
    message: string,
    userId: string,
    tenantId: string,
    context?: any[]
  ): AsyncGenerator<StreamingResponse> {
    try {
      let conversation = this.conversations.get(conversationId)
      if (!conversation) {
        conversation = {
          conversationId,
          userId,
          tenantId,
          messages: [],
          metadata: {}
        }
        this.conversations.set(conversationId, conversation)
      }

      const messages = [
        new SystemMessage('You are an AI assistant specialized in contract analysis.'),
        ...conversation.messages.map(m =>
          m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
        ),
        new HumanMessage(this.buildPromptWithContext(message, context))
      ]

      let fullResponse = ''

      const stream = await this.llm.stream(messages)

      for await (const chunk of stream) {
        const content = chunk.content.toString()
        fullResponse += content

        yield {
          conversationId,
          chunk: content,
          isComplete: false
        }
      }

      // Update conversation
      conversation.messages.push(
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: fullResponse, timestamp: new Date() }
      )

      const confidence = this.calculateResponseConfidence(fullResponse, context)

      yield {
        conversationId,
        chunk: '',
        isComplete: true,
        sources: context,
        confidence
      }
    } catch (error) {
      logger.error({ error, conversationId }, 'Stream chat failed')
      throw error
    }
  }

  /**
   * Clear conversation history
   */
  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId)
  }

  /**
   * Get conversation history
   */
  getConversation(conversationId: string): ConversationContext | undefined {
    return this.conversations.get(conversationId)
  }

  private buildPromptWithContext(message: string, context?: any[]): string {
    if (!context || context.length === 0) {
      return message
    }

    const contextText = context
      .map((c, i) => `[Source ${i + 1}]: ${c.content || c.excerpt || JSON.stringify(c)}`)
      .join('\n\n')

    return `Context:\n${contextText}\n\nQuestion: ${message}\n\nProvide a detailed answer based on the context above.`
  }

  private calculateResponseConfidence(response: string, context?: any[]): number {
    let confidence = 0.5

    // Boost if response references sources
    if (response.match(/source|according to|based on/i)) {
      confidence += 0.2
    }

    // Boost if response is detailed
    if (response.length > 200) {
      confidence += 0.1
    }

    // Boost if context is provided
    if (context && context.length > 0) {
      confidence += 0.1 * Math.min(context.length / 3, 1)
    }

    // Reduce if response contains uncertainty markers
    if (response.match(/might|maybe|possibly|unclear|uncertain/i)) {
      confidence -= 0.2
    }

    return Math.max(0.1, Math.min(0.95, confidence))
  }

  private detectHallucinations(response: string, context?: any[]): number {
    if (!context || context.length === 0) return 0

    // Simple hallucination detection: check if response contains facts not in context
    const contextText = context.map(c => c.content || c.excerpt || '').join(' ').toLowerCase()
    const responseWords = response.toLowerCase().split(/\s+/)

    // Count words in response that don't appear in context
    const uniqueWords = responseWords.filter(word => 
      word.length > 4 && !contextText.includes(word)
    )

    return Math.min(uniqueWords.length / responseWords.length, 1)
  }
}

export const advancedRAGService = AdvancedRAGService.getInstance()
