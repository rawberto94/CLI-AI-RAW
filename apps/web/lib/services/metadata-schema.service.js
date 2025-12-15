"use strict";
/**
 * Client Metadata Schema Service
 *
 * Manages custom metadata field definitions per client/tenant.
 * Allows each client to define their own metadata fields for contracts.
 *
 * Features:
 * - Custom field definitions per tenant
 * - Field types: text, number, date, select, multiselect, boolean, currency
 * - Field validation rules
 * - Field grouping/categories
 * - Default values and AI extraction hints
 * - Field visibility and permissions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataSchemaService = exports.MetadataSchemaService = void 0;
const data_orchestration_1 = require("data-orchestration");
// ============================================================================
// Default Schema
// ============================================================================
const DEFAULT_CATEGORIES = [
    { id: 'core', name: 'core', label: 'Core Information', icon: 'file-text', color: 'blue', sortOrder: 0 },
    { id: 'parties', name: 'parties', label: 'Parties', icon: 'users', color: 'green', sortOrder: 1 },
    { id: 'financial', name: 'financial', label: 'Financial', icon: 'dollar-sign', color: 'emerald', sortOrder: 2 },
    { id: 'dates', name: 'dates', label: 'Key Dates', icon: 'calendar', color: 'purple', sortOrder: 3 },
    { id: 'legal', name: 'legal', label: 'Legal & Compliance', icon: 'shield', color: 'red', sortOrder: 4 },
    { id: 'custom', name: 'custom', label: 'Custom Fields', icon: 'settings', color: 'gray', sortOrder: 5 },
];
const DEFAULT_FIELDS = [
    // Core
    {
        name: 'contract_title',
        label: 'Contract Title',
        type: 'text',
        category: 'core',
        required: true,
        readOnly: false,
        hidden: false,
        sortOrder: 0,
        validations: [{ type: 'required', message: 'Contract title is required' }],
        aiExtractionEnabled: true,
        aiExtractionHint: 'Look for the title or name of the agreement',
        showInList: true,
        showInCard: true,
        searchable: true,
        filterable: false,
        width: 'full',
    },
    {
        name: 'contract_type',
        label: 'Contract Type',
        type: 'select',
        category: 'core',
        required: true,
        readOnly: false,
        hidden: false,
        sortOrder: 1,
        validations: [],
        options: [
            { value: 'msa', label: 'Master Service Agreement' },
            { value: 'sow', label: 'Statement of Work' },
            { value: 'nda', label: 'Non-Disclosure Agreement' },
            { value: 'license', label: 'License Agreement' },
            { value: 'saas', label: 'SaaS Agreement' },
            { value: 'employment', label: 'Employment Contract' },
            { value: 'vendor', label: 'Vendor Agreement' },
            { value: 'partnership', label: 'Partnership Agreement' },
            { value: 'other', label: 'Other' },
        ],
        aiExtractionEnabled: true,
        aiExtractionHint: 'Identify the type of legal agreement',
        showInList: true,
        showInCard: true,
        searchable: false,
        filterable: true,
        width: 'half',
    },
    {
        name: 'status',
        label: 'Status',
        type: 'select',
        category: 'core',
        required: true,
        readOnly: false,
        hidden: false,
        sortOrder: 2,
        validations: [],
        options: [
            { value: 'draft', label: 'Draft', color: 'gray' },
            { value: 'pending_review', label: 'Pending Review', color: 'yellow' },
            { value: 'active', label: 'Active', color: 'green' },
            { value: 'expired', label: 'Expired', color: 'red' },
            { value: 'terminated', label: 'Terminated', color: 'red' },
            { value: 'renewed', label: 'Renewed', color: 'blue' },
        ],
        aiExtractionEnabled: false,
        defaultValue: 'active',
        showInList: true,
        showInCard: true,
        searchable: false,
        filterable: true,
        width: 'half',
    },
    // Parties
    {
        name: 'client_name',
        label: 'Client Name',
        type: 'text',
        category: 'parties',
        required: true,
        readOnly: false,
        hidden: false,
        sortOrder: 0,
        validations: [],
        aiExtractionEnabled: true,
        aiExtractionHint: 'Find the client, customer, or buyer party name',
        showInList: true,
        showInCard: true,
        searchable: true,
        filterable: true,
        width: 'half',
    },
    {
        name: 'supplier_name',
        label: 'Supplier/Vendor Name',
        type: 'text',
        category: 'parties',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 1,
        validations: [],
        aiExtractionEnabled: true,
        aiExtractionHint: 'Find the supplier, vendor, or service provider name',
        showInList: true,
        showInCard: true,
        searchable: true,
        filterable: true,
        width: 'half',
    },
    {
        name: 'client_contact',
        label: 'Client Contact',
        type: 'text',
        category: 'parties',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 2,
        validations: [],
        aiExtractionEnabled: true,
        showInList: false,
        showInCard: false,
        width: 'half',
    },
    {
        name: 'supplier_contact',
        label: 'Supplier Contact',
        type: 'text',
        category: 'parties',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 3,
        validations: [],
        aiExtractionEnabled: true,
        showInList: false,
        showInCard: false,
        width: 'half',
    },
    // Financial
    {
        name: 'total_value',
        label: 'Total Contract Value',
        type: 'currency',
        category: 'financial',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 0,
        validations: [],
        currency: 'CHF',
        aiExtractionEnabled: true,
        aiExtractionHint: 'Find the total value, price, or amount of the contract',
        showInList: true,
        showInCard: true,
        searchable: false,
        filterable: true,
        width: 'half',
    },
    {
        name: 'currency',
        label: 'Currency',
        type: 'select',
        category: 'financial',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 1,
        validations: [],
        options: [
            { value: 'CHF', label: 'Swiss Franc (CHF)' },
            { value: 'EUR', label: 'Euro (EUR)' },
            { value: 'USD', label: 'US Dollar (USD)' },
            { value: 'GBP', label: 'British Pound (GBP)' },
        ],
        defaultValue: 'CHF',
        aiExtractionEnabled: true,
        showInList: false,
        showInCard: false,
        width: 'half',
    },
    {
        name: 'payment_terms',
        label: 'Payment Terms',
        type: 'select',
        category: 'financial',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 2,
        validations: [],
        options: [
            { value: 'net_30', label: 'Net 30' },
            { value: 'net_60', label: 'Net 60' },
            { value: 'net_90', label: 'Net 90' },
            { value: 'due_on_receipt', label: 'Due on Receipt' },
            { value: 'advance', label: 'Advance Payment' },
            { value: 'milestone', label: 'Milestone-based' },
            { value: 'other', label: 'Other' },
        ],
        aiExtractionEnabled: true,
        aiExtractionHint: 'Find payment terms like Net 30, Net 60, etc.',
        showInList: false,
        showInCard: false,
        width: 'half',
    },
    // Dates
    {
        name: 'effective_date',
        label: 'Effective Date',
        type: 'date',
        category: 'dates',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 0,
        validations: [],
        aiExtractionEnabled: true,
        aiExtractionHint: 'Find the start date or effective date',
        showInList: true,
        showInCard: true,
        width: 'half',
    },
    {
        name: 'signature_date',
        label: 'Signature Date',
        type: 'date',
        category: 'dates',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 1,
        validations: [],
        aiExtractionEnabled: true,
        aiExtractionHint: 'Find the signature date or date signed (may be near signature blocks)',
        aiConfidenceThreshold: 0.75,
        showInList: false,
        showInCard: false,
        width: 'half',
    },
    {
        name: 'expiration_date',
        label: 'Expiration Date',
        type: 'date',
        category: 'dates',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 2,
        validations: [],
        aiExtractionEnabled: true,
        aiExtractionHint: 'Find the end date, expiration date, or term',
        showInList: true,
        showInCard: true,
        width: 'half',
    },
    {
        name: 'renewal_date',
        label: 'Renewal Date',
        type: 'date',
        category: 'dates',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 3,
        validations: [],
        aiExtractionEnabled: true,
        showInList: false,
        showInCard: false,
        width: 'half',
    },
    {
        name: 'notice_period',
        label: 'Notice Period (Days)',
        type: 'duration',
        category: 'dates',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 4,
        validations: [],
        min: 0,
        max: 365,
        aiExtractionEnabled: true,
        aiExtractionHint: 'Find the notice period for termination or renewal',
        showInList: false,
        showInCard: false,
        width: 'half',
    },
    // Legal
    {
        name: 'governing_law',
        label: 'Governing Law',
        type: 'text',
        category: 'legal',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 0,
        validations: [],
        aiExtractionEnabled: true,
        aiExtractionHint: 'Find the governing law clause (may be the same as jurisdiction)',
        placeholder: 'e.g., Laws of the State of New York',
        showInList: false,
        showInCard: false,
        width: 'half',
    },
    {
        name: 'jurisdiction',
        label: 'Governing Law/Jurisdiction',
        type: 'text',
        category: 'legal',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 1,
        validations: [],
        aiExtractionEnabled: true,
        aiExtractionHint: 'Find the governing law or jurisdiction clause',
        placeholder: 'e.g., Switzerland, Canton of Zurich',
        showInList: false,
        showInCard: false,
        width: 'half',
    },
    {
        name: 'confidentiality',
        label: 'Confidentiality Terms',
        type: 'select',
        category: 'legal',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 2,
        validations: [],
        options: [
            { value: 'standard', label: 'Standard NDA' },
            { value: 'mutual', label: 'Mutual Confidentiality' },
            { value: 'one_way', label: 'One-Way Confidentiality' },
            { value: 'none', label: 'No Confidentiality' },
        ],
        aiExtractionEnabled: true,
        showInList: false,
        showInCard: false,
        width: 'half',
    },
    {
        name: 'liability_cap',
        label: 'Liability Cap',
        type: 'currency',
        category: 'legal',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 3,
        validations: [],
        aiExtractionEnabled: true,
        aiExtractionHint: 'Find any limitation of liability or liability cap amount',
        showInList: false,
        showInCard: false,
        width: 'half',
    },
    {
        name: 'auto_renewal',
        label: 'Auto-Renewal',
        type: 'boolean',
        category: 'legal',
        required: false,
        readOnly: false,
        hidden: false,
        sortOrder: 4,
        validations: [],
        defaultValue: false,
        aiExtractionEnabled: true,
        aiExtractionHint: 'Check if the contract has auto-renewal or evergreen clause',
        showInList: false,
        showInCard: true,
        width: 'half',
    },
];
// ============================================================================
// Service Class
// ============================================================================
class MetadataSchemaService {
    static instance;
    constructor() { }
    static getInstance() {
        if (!MetadataSchemaService.instance) {
            MetadataSchemaService.instance = new MetadataSchemaService();
        }
        return MetadataSchemaService.instance;
    }
    // =========================================================================
    // Schema Management
    // =========================================================================
    /**
     * Get the metadata schema for a tenant
     */
    async getSchema(tenantId) {
        try {
            const prisma = data_orchestration_1.dbAdaptor.getClient();
            // Try to get tenant-specific schema from TenantConfig
            const tenantConfig = await prisma.tenantConfig.findUnique({
                where: { tenantId },
            });
            if (tenantConfig?.integrations) {
                const integrations = tenantConfig.integrations;
                if (integrations.metadataSchema) {
                    return integrations.metadataSchema;
                }
            }
            // Return default schema if no custom one exists
            return this.getDefaultSchema(tenantId);
        }
        catch (error) {
            console.error('Failed to get metadata schema:', error);
            return this.getDefaultSchema(tenantId);
        }
    }
    /**
     * Get the default metadata schema
     */
    getDefaultSchema(tenantId) {
        const now = new Date();
        return {
            id: `default-${tenantId}`,
            tenantId,
            name: 'Default Schema',
            description: 'Standard contract metadata fields',
            version: 1,
            isDefault: true,
            categories: DEFAULT_CATEGORIES,
            fields: DEFAULT_FIELDS.map((field, index) => ({
                ...field,
                id: `field-${field.name}`,
                createdAt: now,
                updatedAt: now,
            })),
            createdAt: now,
            updatedAt: now,
        };
    }
    /**
     * Save or update a metadata schema for a tenant
     */
    async saveSchema(schema) {
        const prisma = data_orchestration_1.dbAdaptor.getClient();
        const updatedSchema = {
            ...schema,
            updatedAt: new Date(),
            version: schema.version + 1,
        };
        // Update TenantConfig with the new schema
        await prisma.tenantConfig.upsert({
            where: { tenantId: schema.tenantId },
            update: {
                integrations: JSON.parse(JSON.stringify({
                    metadataSchema: updatedSchema,
                })),
                updatedAt: new Date(),
            },
            create: {
                tenantId: schema.tenantId,
                integrations: JSON.parse(JSON.stringify({
                    metadataSchema: updatedSchema,
                })),
            },
        });
        return updatedSchema;
    }
    // =========================================================================
    // Field Management
    // =========================================================================
    /**
     * Add a new field to the schema
     */
    async addField(tenantId, input, userId) {
        const schema = await this.getSchema(tenantId);
        // Generate field ID
        const fieldId = `field-${input.name.toLowerCase().replace(/\s+/g, '_')}-${Date.now()}`;
        // Create new field
        const newField = {
            id: fieldId,
            name: input.name.toLowerCase().replace(/\s+/g, '_'),
            label: input.label,
            type: input.type,
            category: input.category,
            description: input.description,
            required: input.required ?? false,
            readOnly: false,
            hidden: false,
            sortOrder: schema.fields.filter(f => f.category === input.category).length,
            validations: input.validations || [],
            options: input.options,
            defaultValue: input.defaultValue,
            placeholder: input.placeholder,
            helpText: input.helpText,
            aiExtractionEnabled: input.aiExtractionEnabled ?? false,
            aiExtractionHint: input.aiExtractionHint,
            showInList: input.showInList ?? false,
            showInCard: input.showInCard ?? false,
            searchable: input.searchable ?? false,
            filterable: input.filterable ?? false,
            width: 'half',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: userId,
        };
        // Add to schema
        schema.fields.push(newField);
        schema.isDefault = false;
        await this.saveSchema(schema);
        return newField;
    }
    /**
     * Update an existing field
     */
    async updateField(tenantId, input) {
        const schema = await this.getSchema(tenantId);
        const fieldIndex = schema.fields.findIndex(f => f.id === input.id);
        if (fieldIndex === -1) {
            throw new Error(`Field not found: ${input.id}`);
        }
        const existingField = schema.fields[fieldIndex];
        const updatedField = {
            ...existingField,
            ...input,
            updatedAt: new Date(),
        };
        schema.fields[fieldIndex] = updatedField;
        schema.isDefault = false;
        await this.saveSchema(schema);
        return updatedField;
    }
    /**
     * Delete a field from the schema
     */
    async deleteField(tenantId, fieldId) {
        const schema = await this.getSchema(tenantId);
        schema.fields = schema.fields.filter(f => f.id !== fieldId);
        schema.isDefault = false;
        await this.saveSchema(schema);
    }
    /**
     * Reorder fields within a category
     */
    async reorderFields(tenantId, category, fieldIds) {
        const schema = await this.getSchema(tenantId);
        fieldIds.forEach((fieldId, index) => {
            const field = schema.fields.find(f => f.id === fieldId);
            if (field && field.category === category) {
                field.sortOrder = index;
            }
        });
        await this.saveSchema(schema);
    }
    // =========================================================================
    // Category Management
    // =========================================================================
    /**
     * Add a new category
     */
    async addCategory(tenantId, category) {
        const schema = await this.getSchema(tenantId);
        const newCategory = {
            ...category,
            id: `cat-${category.name.toLowerCase().replace(/\s+/g, '_')}-${Date.now()}`,
        };
        schema.categories.push(newCategory);
        schema.isDefault = false;
        await this.saveSchema(schema);
        return newCategory;
    }
    /**
     * Update a category
     */
    async updateCategory(tenantId, categoryId, updates) {
        const schema = await this.getSchema(tenantId);
        const categoryIndex = schema.categories.findIndex(c => c.id === categoryId);
        if (categoryIndex === -1) {
            throw new Error(`Category not found: ${categoryId}`);
        }
        const existingCategory = schema.categories[categoryIndex];
        schema.categories[categoryIndex] = {
            ...existingCategory,
            ...updates,
        };
        await this.saveSchema(schema);
        return schema.categories[categoryIndex];
    }
    /**
     * Delete a category (moves fields to 'custom' category)
     */
    async deleteCategory(tenantId, categoryId) {
        const schema = await this.getSchema(tenantId);
        // Move fields to 'custom' category
        schema.fields.forEach(field => {
            if (field.category === categoryId) {
                field.category = 'custom';
            }
        });
        // Remove category
        schema.categories = schema.categories.filter(c => c.id !== categoryId);
        schema.isDefault = false;
        await this.saveSchema(schema);
    }
    // =========================================================================
    // Utilities
    // =========================================================================
    /**
     * Get fields by category
     */
    async getFieldsByCategory(tenantId, category) {
        const schema = await this.getSchema(tenantId);
        return schema.fields
            .filter(f => f.category === category)
            .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    /**
     * Get searchable fields
     */
    async getSearchableFields(tenantId) {
        const schema = await this.getSchema(tenantId);
        return schema.fields.filter(f => f.searchable);
    }
    /**
     * Get filterable fields
     */
    async getFilterableFields(tenantId) {
        const schema = await this.getSchema(tenantId);
        return schema.fields.filter(f => f.filterable);
    }
    /**
     * Get AI extraction enabled fields
     */
    async getAIExtractionFields(tenantId) {
        const schema = await this.getSchema(tenantId);
        return schema.fields.filter(f => f.aiExtractionEnabled);
    }
    /**
     * Validate metadata against schema
     */
    async validateMetadata(tenantId, metadata) {
        const schema = await this.getSchema(tenantId);
        const errors = [];
        for (const field of schema.fields) {
            const value = metadata[field.name];
            // Check required
            if (field.required && (value === undefined || value === null || value === '')) {
                errors.push({ field: field.name, message: `${field.label} is required` });
                continue;
            }
            // Skip if no value and not required
            if (value === undefined || value === null)
                continue;
            // Run validations
            for (const validation of field.validations) {
                switch (validation.type) {
                    case 'minLength':
                        if (typeof value === 'string' && value.length < validation.value) {
                            errors.push({ field: field.name, message: validation.message });
                        }
                        break;
                    case 'maxLength':
                        if (typeof value === 'string' && value.length > validation.value) {
                            errors.push({ field: field.name, message: validation.message });
                        }
                        break;
                    case 'min':
                        if (typeof value === 'number' && value < validation.value) {
                            errors.push({ field: field.name, message: validation.message });
                        }
                        break;
                    case 'max':
                        if (typeof value === 'number' && value > validation.value) {
                            errors.push({ field: field.name, message: validation.message });
                        }
                        break;
                    case 'pattern':
                        if (typeof value === 'string' && !new RegExp(validation.value).test(value)) {
                            errors.push({ field: field.name, message: validation.message });
                        }
                        break;
                }
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
        };
    }
    /**
     * Reset to default schema
     */
    async resetToDefault(tenantId) {
        const defaultSchema = this.getDefaultSchema(tenantId);
        await this.saveSchema(defaultSchema);
        return defaultSchema;
    }
    /**
     * Export schema as JSON
     */
    async exportSchema(tenantId) {
        const schema = await this.getSchema(tenantId);
        return JSON.stringify(schema, null, 2);
    }
    /**
     * Import schema from JSON
     */
    async importSchema(tenantId, schemaJson) {
        const imported = JSON.parse(schemaJson);
        // Update tenant ID and timestamps
        imported.tenantId = tenantId;
        imported.updatedAt = new Date();
        imported.isDefault = false;
        await this.saveSchema(imported);
        return imported;
    }
}
exports.MetadataSchemaService = MetadataSchemaService;
// Export singleton
exports.metadataSchemaService = MetadataSchemaService.getInstance();
exports.default = exports.metadataSchemaService;
