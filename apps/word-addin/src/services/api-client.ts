/**
 * ConTigo API Client for Word Add-in
 * Handles all communication with the ConTigo backend
 */

declare const CONTIGO_API_URL: string | undefined;

const API_BASE_URL = (typeof CONTIGO_API_URL !== 'undefined' ? CONTIGO_API_URL : null) || 'https://contigo.app/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// TYPES
// ============================================================================

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'MSA' | 'SOW' | 'NDA' | 'AMENDMENT' | 'SLA' | 'OTHER' | string;
  folder: string;
  content: TemplateContent;
  variables: TemplateVariable[];
  clauses: string[]; // Clause IDs
  isActive: boolean;
  version: number;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateContent {
  sections: TemplateSection[];
  styles?: {
    headingFont: string;
    bodyFont: string;
    fontSize: number;
  };
}

export interface TemplateSection {
  id: string;
  heading: string;
  level: number;
  content: string;
  clauseId?: string;
  isOptional: boolean;
}

export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'party' | 'currency';
  required: boolean;
  defaultValue?: string;
  options?: string[];
  placeholder: string;
  description?: string;
}

export interface Clause {
  id: string;
  name: string;
  category: string;
  content: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isStandard: boolean;
  alternatives?: ClauseAlternative[];
  guidance?: string;
  tags: string[];
  usageCount: number;
}

export interface ClauseAlternative {
  id: string;
  name: string;
  content: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  useCase: string;
}

export interface AIAssistRequest {
  context: string;
  selection?: string;
  action: 'suggest' | 'improve' | 'simplify' | 'risk-check' | 'complete';
  contractType?: string;
}

export interface AIAssistResponse {
  suggestions: AISuggestion[];
  riskFlags?: RiskFlag[];
  confidence: number;
}

export interface AISuggestion {
  id: string;
  text: string;
  explanation: string;
  type: 'clause' | 'improvement' | 'completion';
  confidence: number;
}

export interface RiskFlag {
  text: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  explanation: string;
  suggestion?: string;
}

export interface GenerateContractRequest {
  templateId: string;
  variables: Record<string, string>;
  selectedClauses?: string[];
  format: 'ooxml' | 'html' | 'plain';
}

export interface GenerateContractResponse {
  content: string;
  format: string;
  contractId: string;
  draftId: string;
}

/** Full-document AI review result */
export interface DocumentReview {
  /** Overall completeness (0-100) */
  completenessScore: number;
  /** Auto-detected contract type */
  detectedType: string;
  /** Structural analysis */
  structure: {
    sectionsFound: string[];
    missingRecommended: string[];
  };
  /** Risk flags across the entire document */
  risks: Array<{
    text: string;
    risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    explanation: string;
    suggestion: string;
    section?: string;
  }>;
  /** Improvement suggestions */
  suggestions: Array<{
    id: string;
    section: string;
    text: string;
    explanation: string;
    type: 'missing-clause' | 'improvement' | 'ambiguity' | 'compliance';
  }>;
  /** Executive summary */
  summary: string;
}

// ============================================================================
// API CLIENT
// ============================================================================

class ContigoApiClient {
  private static instance: ContigoApiClient;
  private authToken: string | null = null;
  private tenantId: string | null = null;

  private constructor() {}

  static getInstance(): ContigoApiClient {
    if (!ContigoApiClient.instance) {
      ContigoApiClient.instance = new ContigoApiClient();
    }
    return ContigoApiClient.instance;
  }

  setAuth(token: string, tenantId: string): void {
    this.authToken = token;
    this.tenantId = tenantId;
  }

  clearAuth(): void {
    this.authToken = null;
    this.tenantId = null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      ...(this.tenantId && { 'X-Tenant-ID': this.tenantId }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || { code: 'UNKNOWN', message: response.statusText },
        };
      }

      return { success: true, data: data.data || data };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  async login(email: string, password: string): Promise<ApiResponse<{ token: string; tenantId: string }>> {
    return this.request('/auth/addin-login', {
      method: 'POST',
      body: JSON.stringify({ email, password, source: 'word-addin' }),
    });
  }

  async validateToken(): Promise<ApiResponse<{ valid: boolean }>> {
    return this.request('/auth/validate');
  }

  async exchangeOfficeToken(officeToken: string): Promise<ApiResponse<{ token: string; tenantId: string; user: { id: string; email: string; name: string } }>> {
    return this.request('/auth/sso/office', {
      method: 'POST',
      body: JSON.stringify({ officeToken }),
    });
  }

  // ============================================================================
  // TEMPLATES
  // ============================================================================

  async getTemplates(category?: string, search?: string, sort?: string): Promise<ApiResponse<{ templates: Template[]; total: number }>> {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    if (sort) params.set('sort', sort);
    const query = params.toString();
    return this.request(`/word-addin/templates${query ? `?${query}` : ''}`);
  }

  async getTemplate(id: string): Promise<ApiResponse<Template>> {
    return this.request(`/word-addin/templates/${id}`);
  }

  async createTemplate(template: {
    name: string;
    description?: string;
    category?: string;
    content?: { sections: Array<{ id: string; heading: string; level: number; content: string; isOptional?: boolean }> };
    variables?: TemplateVariable[];
  }): Promise<ApiResponse<Template>> {
    return this.request('/word-addin/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  }

  async updateTemplate(id: string, template: Partial<{
    name: string;
    description: string;
    category: string;
    content: unknown;
    variables: TemplateVariable[];
    isActive: boolean;
  }>): Promise<ApiResponse<Template>> {
    return this.request(`/word-addin/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(template),
    });
  }

  async deleteTemplate(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.request(`/word-addin/templates/${id}`, {
      method: 'DELETE',
    });
  }

  async duplicateTemplate(id: string, newName: string): Promise<ApiResponse<Template>> {
    // Fetch full template, then create a copy
    const result = await this.getTemplate(id);
    if (!result.success || !result.data) {
      return { success: false, error: result.error || { code: 'NOT_FOUND', message: 'Template not found' } };
    }
    const t = result.data;
    return this.createTemplate({
      name: newName,
      description: t.description,
      category: t.category,
      content: t.content,
      variables: t.variables,
    });
  }

  async getTemplateFolders(): Promise<ApiResponse<{
    folders: Array<{ name: string; count: number; isBuiltIn: boolean }>;
    totalCount: number;
  }>> {
    return this.request('/word-addin/templates/folders');
  }

  async moveTemplatesToFolder(templateIds: string[], folder: string): Promise<ApiResponse<{ moved: number }>> {
    return this.request('/word-addin/templates/folders', {
      method: 'POST',
      body: JSON.stringify({ action: 'move', templateIds, folder }),
    });
  }

  async renameFolder(oldFolder: string, newFolder: string): Promise<ApiResponse<{ renamed: number }>> {
    return this.request('/word-addin/templates/folders', {
      method: 'POST',
      body: JSON.stringify({ action: 'rename', oldFolder, newFolder }),
    });
  }

  // ============================================================================
  // CLAUSES
  // ============================================================================

  async getClauses(params?: {
    category?: string;
    riskLevel?: string;
    search?: string;
  }): Promise<ApiResponse<Clause[]>> {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v))
    ).toString();
    return this.request(`/word-addin/clauses${query ? `?${query}` : ''}`);
  }

  async getClause(id: string): Promise<ApiResponse<Clause>> {
    return this.request(`/word-addin/clauses/${id}`);
  }

  async getClauseAlternatives(id: string): Promise<ApiResponse<ClauseAlternative[]>> {
    return this.request(`/word-addin/clauses/${id}/alternatives`);
  }

  async suggestClause(context: {
    contractType: string;
    section: string;
    existingText?: string;
  }): Promise<ApiResponse<Clause[]>> {
    return this.request('/word-addin/clauses/suggest', {
      method: 'POST',
      body: JSON.stringify(context),
    });
  }

  async createClause(clause: Omit<Clause, 'id' | 'usageCount'>): Promise<ApiResponse<Clause>> {
    return this.request('/word-addin/clauses', {
      method: 'POST',
      body: JSON.stringify(clause),
    });
  }

  async updateClause(id: string, clause: Partial<Clause>): Promise<ApiResponse<Clause>> {
    return this.request(`/word-addin/clauses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clause),
    });
  }

  // ============================================================================
  // CONTRACT GENERATION
  // ============================================================================

  async generateContract(request: GenerateContractRequest): Promise<ApiResponse<GenerateContractResponse>> {
    return this.request('/word-addin/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * AI-powered contract draft generation
   * Uses GPT to produce a complete contract from template + variables + clauses
   */
  async generateAIDraft(request: {
    contractType: string;
    variables: Record<string, string>;
    templateId?: string;
    clauses?: string[];
    tone?: 'formal' | 'standard' | 'plain-english';
    jurisdiction?: string;
    additionalInstructions?: string;
  }): Promise<ApiResponse<{
    html: string;
    plainText: string;
    contractType: string;
    metadata: { model: string; generatedAt: string };
  }>> {
    return this.request('/ai/generate/draft', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async saveContractDraft(data: {
    templateId?: string;
    title: string;
    content: string;
    variables: Record<string, string>;
  }): Promise<ApiResponse<{ draftId: string }>> {
    return this.request('/word-addin/drafts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getContractDrafts(): Promise<ApiResponse<Array<{
    id: string;
    title: string;
    templateName: string;
    updatedAt: string;
    status: string;
  }>>> {
    return this.request('/word-addin/drafts');
  }

  async loadContractDraft(draftId: string): Promise<ApiResponse<{
    id: string;
    title: string;
    content: string;
    variables: Record<string, string>;
    status: string;
    template: Template | null;
  }>> {
    return this.request(`/word-addin/drafts/${draftId}`);
  }

  async updateContractDraft(draftId: string, data: {
    title?: string;
    content?: string;
    variables?: Record<string, string>;
    status?: string;
  }): Promise<ApiResponse<{ id: string; status: string }>> {
    return this.request(`/word-addin/drafts/${draftId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteContractDraft(draftId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.request(`/word-addin/drafts/${draftId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // AI ASSISTANCE
  // ============================================================================

  async getAIAssist(request: AIAssistRequest): Promise<ApiResponse<AIAssistResponse>> {
    return this.request('/word-addin/ai/assist', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Full-document AI review — analyzes the entire document for risks,
   * missing sections, completeness, and structural issues.
   */
  async reviewDocument(request: {
    documentText: string;
    headings: Array<{ text: string; level: number }>;
    contractType?: string;
    wordCount: number;
  }): Promise<ApiResponse<DocumentReview>> {
    return this.request('/word-addin/ai/review', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async analyzeRisk(text: string): Promise<ApiResponse<{
    risks: RiskFlag[];
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    score: number;
  }>> {
    return this.request('/word-addin/ai/analyze-risk', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async improveClause(text: string, style?: 'formal' | 'simple' | 'detailed'): Promise<ApiResponse<{
    improved: string;
    changes: string[];
  }>> {
    return this.request('/word-addin/ai/improve', {
      method: 'POST',
      body: JSON.stringify({ text, style }),
    });
  }

  async autoComplete(context: string, partialText: string): Promise<ApiResponse<{
    completions: string[];
  }>> {
    return this.request('/word-addin/ai/complete', {
      method: 'POST',
      body: JSON.stringify({ context, partialText }),
    });
  }

  // ============================================================================
  // VARIABLES
  // ============================================================================

  async getPartyDefaults(partyType: 'buyer' | 'seller' | 'supplier'): Promise<ApiResponse<{
    name: string;
    address: string;
    contact: string;
    email: string;
  }>> {
    return this.request(`/word-addin/parties/defaults?type=${partyType}`);
  }

  async savePartyDefaults(partyType: string, data: Record<string, string>): Promise<ApiResponse<void>> {
    return this.request('/word-addin/parties/defaults', {
      method: 'POST',
      body: JSON.stringify({ type: partyType, ...data }),
    });
  }

  // ============================================================================
  // UPLOAD TO CONTIGO
  // ============================================================================

  async uploadContract(data: {
    title: string;
    content: string; // Base64 OOXML
    variables: Record<string, string>;
    templateId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ApiResponse<{ contractId: string }>> {
    return this.request('/word-addin/upload', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // HEALTH & SETTINGS
  // ============================================================================

  async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    return this.request('/health');
  }

  async saveUserSettings(settings: Record<string, unknown>): Promise<ApiResponse<void>> {
    return this.request('/word-addin/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  async getUserSettings(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request('/word-addin/settings');
  }
}

export const apiClient = ContigoApiClient.getInstance();
