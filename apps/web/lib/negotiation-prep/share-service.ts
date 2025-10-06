/**
 * Share Service for Negotiation Prep
 * Manages shareable links and permissions
 */

export interface SharedScenario {
  id: string
  scenarioId: string
  createdBy: string
  createdAt: Date
  expiresAt: Date | null
  permission: 'read' | 'edit'
  accessCount: number
  lastAccessedAt: Date | null
  isActive: boolean
  
  // Scenario data
  scenarioData: {
    role: string
    level: string
    location: string
    supplier: string
    currentRate: number
    targetRate: number
    strategy: string
    notes?: string
  }
}

export class ShareService {
  private static sharedScenarios: SharedScenario[] = []

  /**
   * Create a shareable link
   */
  static createShareLink(
    scenarioId: string,
    createdBy: string,
    permission: 'read' | 'edit',
    expiresInDays?: number,
    scenarioData?: any
  ): SharedScenario {
    const id = this.generateShareId()
    const createdAt = new Date()
    const expiresAt = expiresInDays 
      ? new Date(createdAt.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
      : null

    const sharedScenario: SharedScenario = {
      id,
      scenarioId,
      createdBy,
      createdAt,
      expiresAt,
      permission,
      accessCount: 0,
      lastAccessedAt: null,
      isActive: true,
      scenarioData: scenarioData || {
        role: '',
        level: '',
        location: '',
        supplier: '',
        currentRate: 0,
        targetRate: 0,
        strategy: ''
      }
    }

    this.sharedScenarios.push(sharedScenario)
    return sharedScenario
  }

  /**
   * Get shared scenario by ID
   */
  static getSharedScenario(shareId: string): SharedScenario | null {
    const scenario = this.sharedScenarios.find(s => s.id === shareId)
    
    if (!scenario) return null
    if (!scenario.isActive) return null
    if (scenario.expiresAt && scenario.expiresAt < new Date()) {
      scenario.isActive = false
      return null
    }

    // Track access
    scenario.accessCount++
    scenario.lastAccessedAt = new Date()

    return scenario
  }

  /**
   * Get all shared scenarios created by a user
   */
  static getUserSharedScenarios(userId: string): SharedScenario[] {
    return this.sharedScenarios
      .filter(s => s.createdBy === userId && s.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  /**
   * Revoke a shared link
   */
  static revokeShareLink(shareId: string): boolean {
    const scenario = this.sharedScenarios.find(s => s.id === shareId)
    if (!scenario) return false

    scenario.isActive = false
    return true
  }

  /**
   * Update share permissions
   */
  static updatePermission(shareId: string, permission: 'read' | 'edit'): boolean {
    const scenario = this.sharedScenarios.find(s => s.id === shareId)
    if (!scenario) return false

    scenario.permission = permission
    return true
  }

  /**
   * Extend expiration date
   */
  static extendExpiration(shareId: string, additionalDays: number): boolean {
    const scenario = this.sharedScenarios.find(s => s.id === shareId)
    if (!scenario) return false

    if (scenario.expiresAt) {
      scenario.expiresAt = new Date(scenario.expiresAt.getTime() + additionalDays * 24 * 60 * 60 * 1000)
    } else {
      scenario.expiresAt = new Date(Date.now() + additionalDays * 24 * 60 * 60 * 1000)
    }

    return true
  }

  /**
   * Get share statistics
   */
  static getShareStats(shareId: string): {
    accessCount: number
    lastAccessed: Date | null
    daysUntilExpiry: number | null
    isExpired: boolean
  } | null {
    const scenario = this.sharedScenarios.find(s => s.id === shareId)
    if (!scenario) return null

    const daysUntilExpiry = scenario.expiresAt
      ? Math.ceil((scenario.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null

    const isExpired = scenario.expiresAt ? scenario.expiresAt < new Date() : false

    return {
      accessCount: scenario.accessCount,
      lastAccessed: scenario.lastAccessedAt,
      daysUntilExpiry,
      isExpired
    }
  }

  /**
   * Generate shareable URL
   */
  static getShareUrl(shareId: string): string {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/use-cases/negotiation-prep/shared/${shareId}`
    }
    return `/use-cases/negotiation-prep/shared/${shareId}`
  }

  /**
   * Copy share URL to clipboard
   */
  static async copyShareUrl(shareId: string): Promise<boolean> {
    const url = this.getShareUrl(shareId)
    
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        return true
      }
      
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = url
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)
      return success
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      return false
    }
  }

  /**
   * Generate a unique share ID
   */
  private static generateShareId(): string {
    const timestamp = Date.now().toString(36)
    const randomStr = Math.random().toString(36).substring(2, 15)
    return `share-${timestamp}-${randomStr}`
  }

  /**
   * Clean up expired shares
   */
  static cleanupExpiredShares(): number {
    const now = new Date()
    let cleaned = 0

    this.sharedScenarios.forEach(scenario => {
      if (scenario.expiresAt && scenario.expiresAt < now && scenario.isActive) {
        scenario.isActive = false
        cleaned++
      }
    })

    return cleaned
  }

  /**
   * Get all active shares count
   */
  static getActiveSharesCount(): number {
    return this.sharedScenarios.filter(s => s.isActive).length
  }

  /**
   * Clear all shares (for testing)
   */
  static clearShares(): void {
    this.sharedScenarios = []
  }
}
