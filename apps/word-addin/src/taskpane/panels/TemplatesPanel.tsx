/**
 * Templates Panel — Browse, create, edit, delete, and generate contracts.
 * Supports folder (category) grouping, server-side search, and proper Word native styles.
 */

import * as React from 'react';
import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  makeStyles,
  tokens,
  Title2,
  Body1,
  Body2,
  Caption1,
  Button,
  Card,
  CardHeader,
  CardPreview,
  Spinner,
  Input,
  Select,
  Badge,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Field,
  Textarea,
  MessageBar,
  MessageBarBody,
  Menu,
  MenuTrigger,
  MenuList,
  MenuItem,
  MenuPopover,
  Tooltip,
} from '@fluentui/react-components';
import {
  DocumentRegular,
  SearchRegular,
  AddRegular,
  ArrowDownloadRegular,
  EditRegular,
  DeleteRegular,
  CopyRegular,
  FolderRegular,
  MoreHorizontalRegular,
} from '@fluentui/react-icons';
import { apiClient, Template, TemplateVariable } from '../../services/api-client';
import { wordService } from '../../services/word-service';

// =============================================================================
// STYLES
// =============================================================================

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  folderBar: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'wrap',
    marginBottom: tokens.spacingVerticalXS,
  },
  folderChip: {
    cursor: 'pointer',
  },
  filters: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  searchInput: {
    flex: 1,
  },
  stats: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  card: {
    cursor: 'pointer',
    transition: 'box-shadow 0.2s',
    position: 'relative' as const,
    ':hover': {
      boxShadow: tokens.shadow16,
    },
  },
  cardMenu: {
    position: 'absolute' as const,
    top: tokens.spacingVerticalXS,
    right: tokens.spacingHorizontalXS,
    zIndex: 1,
  },
  cardPreview: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '70px',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingBottom: tokens.spacingVerticalS,
  },
  variableForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    maxHeight: '400px',
    overflowY: 'auto' as const,
    paddingRight: tokens.spacingHorizontalS,
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXL,
  },
  empty: {
    textAlign: 'center' as const,
    padding: tokens.spacingVerticalXL,
    color: tokens.colorNeutralForeground3,
  },
});

// =============================================================================
// BUILT-IN CATEGORIES
// =============================================================================

const BUILT_IN_CATEGORIES = [
  { value: 'MSA', label: 'Master Service Agreement' },
  { value: 'SOW', label: 'Statement of Work' },
  { value: 'NDA', label: 'Non-Disclosure Agreement' },
  { value: 'AMENDMENT', label: 'Amendment' },
  { value: 'SLA', label: 'Service Level Agreement' },
  { value: 'OTHER', label: 'Other' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export const TemplatesPanel: React.FC = () => {
  const styles = useStyles();
  const queryClient = useQueryClient();

  // --- State ---
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [sortBy, setSortBy] = useState('name');

  // Generate dialog
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [useAIDraft, setUseAIDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create / edit dialog
  const [editMode, setEditMode] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<Template | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('OTHER');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  // --- Debounced search ---
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  // --- Queries ---
  const { data: templateData, isLoading } = useQuery({
    queryKey: ['addin-templates', selectedFolder, debouncedSearch, sortBy],
    queryFn: async () => {
      const result = await apiClient.getTemplates(
        selectedFolder || undefined,
        debouncedSearch || undefined,
        sortBy,
      );
      if (result.success && result.data) return result.data;
      throw new Error(result.error?.message || 'Failed to fetch templates');
    },
  });

  const { data: folderData } = useQuery({
    queryKey: ['addin-folders'],
    queryFn: async () => {
      const result = await apiClient.getTemplateFolders();
      if (result.success && result.data) return result.data;
      throw new Error('Failed to fetch folders');
    },
  });

  const templates = templateData?.templates ?? [];
  const totalCount = templateData?.total ?? 0;
  const folders = folderData?.folders ?? [];

  // --- Mutations ---
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['addin-templates'] });
    queryClient.invalidateQueries({ queryKey: ['addin-folders'] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; category: string }) => {
      const result = await apiClient.createTemplate({
        name: data.name,
        description: data.description,
        category: data.category,
        content: { sections: [] },
        variables: [],
      });
      if (!result.success) throw new Error(result.error?.message || 'Create failed');
      return result.data;
    },
    onSuccess: () => { invalidateAll(); setEditMode(null); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; category?: string } }) => {
      const result = await apiClient.updateTemplate(id, data);
      if (!result.success) throw new Error(result.error?.message || 'Update failed');
      return result.data;
    },
    onSuccess: () => { invalidateAll(); setEditMode(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.deleteTemplate(id);
      if (!result.success) throw new Error(result.error?.message || 'Delete failed');
    },
    onSuccess: () => { invalidateAll(); setDeleteTarget(null); },
  });

  const duplicateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const result = await apiClient.duplicateTemplate(id, name);
      if (!result.success) throw new Error(result.error?.message || 'Duplicate failed');
      return result.data;
    },
    onSuccess: invalidateAll,
  });

  // --- Handlers ---
  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template);
    const defaults: Record<string, string> = {};
    template.variables.forEach((v) => { defaults[v.name] = v.defaultValue || ''; });
    setVariableValues(defaults);
    setError(null);
    setUseAIDraft(false);
  }, []);

  const openCreateDialog = useCallback(() => {
    setEditMode('create');
    setEditTarget(null);
    setEditName('');
    setEditDescription('');
    setEditCategory(selectedFolder || 'OTHER');
  }, [selectedFolder]);

  const openEditDialog = useCallback((template: Template) => {
    setEditMode('edit');
    setEditTarget(template);
    setEditName(template.name);
    setEditDescription(template.description);
    setEditCategory(template.category);
  }, []);

  const handleSaveTemplate = useCallback(() => {
    if (!editName.trim()) return;
    if (editMode === 'create') {
      createMutation.mutate({ name: editName, description: editDescription, category: editCategory });
    } else if (editMode === 'edit' && editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: { name: editName, description: editDescription, category: editCategory } });
    }
  }, [editMode, editName, editDescription, editCategory, editTarget, createMutation, updateMutation]);

  // --- Generate: uses insertContract() for native Word styles ---
  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate) return;
    setIsGenerating(true);
    setError(null);

    try {
      const missingRequired = selectedTemplate.variables
        .filter((v) => v.required && !variableValues[v.name])
        .map((v) => v.label);

      if (missingRequired.length > 0) {
        setError(`Missing required fields: ${missingRequired.join(', ')}`);
        setIsGenerating(false);
        return;
      }

      if (useAIDraft) {
        const aiResult = await apiClient.generateAIDraft({
          contractType: selectedTemplate.category,
          variables: variableValues,
          templateId: selectedTemplate.id,
          clauses: selectedTemplate.clauses,
          tone: 'formal',
        });
        if (!aiResult.success || !aiResult.data) throw new Error(aiResult.error?.message || 'AI generation failed');
        await wordService.insertHtml(aiResult.data.html, 'end');
      } else {
        const result = await apiClient.generateContract({
          templateId: selectedTemplate.id,
          variables: variableValues,
          format: 'html',
        });
        if (!result.success || !result.data) throw new Error(result.error?.message || 'Generation failed');

        // If template has structured sections, use native Word styles via insertContract
        const templateContent = selectedTemplate.content;
        if (templateContent?.sections?.length) {
          const sections = templateContent.sections.map((section) => {
            let content = section.content;
            for (const [key, value] of Object.entries(variableValues)) {
              content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `[${key}]`);
            }
            return { heading: section.heading, content, level: section.level };
          });
          await wordService.insertContract({
            title: variableValues.contractTitle || selectedTemplate.name,
            sections,
            styles: { headingFont: 'Calibri', bodyFont: 'Calibri' },
          });
        } else {
          // Fallback: HTML + variable replacement
          await wordService.insertHtml(result.data.content, 'end');
          const variables = Object.entries(variableValues).map(([name, value]) => ({
            name, value, placeholder: `{{${name}}}`,
          }));
          await wordService.replaceVariables(variables);
        }
      }

      setSelectedTemplate(null);
      setUseAIDraft(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedTemplate, variableValues, useAIDraft]);

  // --- Render ---
  if (isLoading) {
    return <div className={styles.loading}><Spinner label="Loading templates..." /></div>;
  }

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <Title2>Templates</Title2>
        <Tooltip content="Create a new template" relationship="label">
          <Button icon={<AddRegular />} appearance="primary" size="small" onClick={openCreateDialog}>
            New
          </Button>
        </Tooltip>
      </div>

      {/* Folder chips */}
      <div className={styles.folderBar}>
        <Badge
          appearance={selectedFolder === '' ? 'filled' : 'outline'}
          color="brand"
          className={styles.folderChip}
          onClick={() => setSelectedFolder('')}
        >
          All ({folderData?.totalCount ?? totalCount})
        </Badge>
        {folders.map((folder) => (
          <Badge
            key={folder.name}
            appearance={selectedFolder === folder.name ? 'filled' : 'outline'}
            color={selectedFolder === folder.name ? 'brand' : 'informative'}
            className={styles.folderChip}
            onClick={() => setSelectedFolder(folder.name === selectedFolder ? '' : folder.name)}
          >
            {folder.name} ({folder.count})
          </Badge>
        ))}
      </div>

      {/* Search + Sort */}
      <div className={styles.filters}>
        <Input
          className={styles.searchInput}
          contentBefore={<SearchRegular />}
          placeholder="Search templates..."
          value={search}
          onChange={(_, data) => handleSearchChange(data.value)}
          size="small"
        />
        <Select size="small" value={sortBy} onChange={(_, data) => setSortBy(data.value)}>
          <option value="name">Name</option>
          <option value="updatedAt">Last Updated</option>
          <option value="usageCount">Most Used</option>
          <option value="createdAt">Date Created</option>
        </Select>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <Caption1>{totalCount} template{totalCount !== 1 ? 's' : ''}</Caption1>
        {selectedFolder && <Caption1>in {selectedFolder}</Caption1>}
        {debouncedSearch && <Caption1>matching &quot;{debouncedSearch}&quot;</Caption1>}
      </div>

      {/* Template grid */}
      {templates.length > 0 ? (
        <div className={styles.grid}>
          {templates.map((template) => (
            <Card key={template.id} className={styles.card}>
              {/* Context menu */}
              <div className={styles.cardMenu}>
                <Menu>
                  <MenuTrigger>
                    <Button
                      icon={<MoreHorizontalRegular />}
                      appearance="subtle"
                      size="small"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem icon={<EditRegular />} onClick={() => openEditDialog(template)}>
                        Edit Details
                      </MenuItem>
                      <MenuItem
                        icon={<CopyRegular />}
                        onClick={() => duplicateMutation.mutate({ id: template.id, name: `${template.name} (Copy)` })}
                      >
                        Duplicate
                      </MenuItem>
                      <MenuItem icon={<DeleteRegular />} onClick={() => setDeleteTarget(template)}>
                        Delete
                      </MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
              </div>

              <div onClick={() => handleSelectTemplate(template)}>
                <CardPreview className={styles.cardPreview}>
                  <DocumentRegular fontSize={36} />
                </CardPreview>
                <CardHeader
                  header={<Body2 weight="semibold">{template.name}</Body2>}
                  description={<Caption1>{template.description || 'No description'}</Caption1>}
                />
              </div>
              <div className={styles.cardFooter}>
                <Badge appearance="outline" color="informative" size="small">
                  {template.category}
                </Badge>
                {template.usageCount > 0 && <Caption1>{template.usageCount} uses</Caption1>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <DocumentRegular fontSize={48} />
          <Body1>No templates found</Body1>
          <Button appearance="primary" icon={<AddRegular />} onClick={openCreateDialog} style={{ marginTop: 12 }}>
            Create your first template
          </Button>
        </div>
      )}

      {/* ====== Generate Dialog ====== */}
      <Dialog
        open={!!selectedTemplate && editMode === null}
        onOpenChange={(_, data) => { if (!data.open) { setSelectedTemplate(null); setUseAIDraft(false); } }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Generate: {selectedTemplate?.name}</DialogTitle>
            <DialogContent>
              {error && (
                <MessageBar intent="error" style={{ marginBottom: 12 }}>
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
              <Body1 style={{ marginBottom: 12 }}>Fill in the contract variables:</Body1>
              <div className={styles.variableForm}>
                {selectedTemplate?.variables.map((variable) => (
                  <Field
                    key={variable.name}
                    label={`${variable.label}${variable.required ? ' *' : ''}`}
                    hint={variable.description}
                  >
                    {renderVariableInput(variable, variableValues, (name, value) => {
                      setVariableValues((prev) => ({ ...prev, [name]: value }));
                    })}
                  </Field>
                ))}
                {(!selectedTemplate?.variables || selectedTemplate.variables.length === 0) && (
                  <Caption1>This template has no variables — it will generate as-is.</Caption1>
                )}
              </div>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => { setSelectedTemplate(null); setUseAIDraft(false); }}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button
                appearance={useAIDraft ? 'primary' : 'subtle'}
                onClick={() => setUseAIDraft(!useAIDraft)}
                disabled={isGenerating}
                size="small"
              >
                {useAIDraft ? '✨ AI Draft ON' : '🤖 Use AI Draft'}
              </Button>
              <Button
                appearance="primary"
                icon={<ArrowDownloadRegular />}
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? <Spinner size="tiny" /> : useAIDraft ? 'Generate with AI' : 'Generate Contract'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* ====== Create / Edit Dialog ====== */}
      <Dialog open={editMode !== null} onOpenChange={(_, data) => { if (!data.open) setEditMode(null); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editMode === 'create' ? 'New Template' : 'Edit Template'}</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Name" required>
                  <Input value={editName} onChange={(_, data) => setEditName(data.value)} placeholder="e.g. Master Service Agreement v2" />
                </Field>
                <Field label="Description">
                  <Textarea value={editDescription} onChange={(_, data) => setEditDescription(data.value)} placeholder="What this template is used for..." rows={3} />
                </Field>
                <Field label="Folder / Category">
                  <Select value={editCategory} onChange={(_, data) => setEditCategory(data.value)}>
                    {BUILT_IN_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                    {folders
                      .filter((f) => !BUILT_IN_CATEGORIES.some((b) => b.value === f.name))
                      .map((f) => <option key={f.name} value={f.name}>{f.name}</option>)
                    }
                  </Select>
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setEditMode(null)}>Cancel</Button>
              <Button
                appearance="primary"
                onClick={handleSaveTemplate}
                disabled={!editName.trim() || createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) ? <Spinner size="tiny" /> : editMode === 'create' ? 'Create' : 'Save'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* ====== Delete Confirmation ====== */}
      <Dialog open={!!deleteTarget} onOpenChange={(_, data) => { if (!data.open) setDeleteTarget(null); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogContent>
              <Body1>Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.</Body1>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                appearance="primary"
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Spinner size="tiny" /> : 'Delete'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

// =============================================================================
// Helper: variable input renderer
// =============================================================================

function renderVariableInput(
  variable: TemplateVariable,
  values: Record<string, string>,
  onChange: (name: string, value: string) => void,
) {
  const value = values[variable.name] || '';

  if (variable.type === 'select' && variable.options) {
    return (
      <Select value={value} onChange={(_, data) => onChange(variable.name, data.value)}>
        <option value="">Select...</option>
        {variable.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </Select>
    );
  }
  if (variable.type === 'date') {
    return <Input type="date" value={value} onChange={(_, data) => onChange(variable.name, data.value)} />;
  }
  if (variable.type === 'currency') {
    return (
      <Input type="number" contentBefore={<span>$</span>} placeholder={variable.placeholder || '0.00'} value={value} onChange={(_, data) => onChange(variable.name, data.value)} />
    );
  }
  return (
    <Input type={variable.type === 'number' ? 'number' : 'text'} placeholder={variable.placeholder} value={value} onChange={(_, data) => onChange(variable.name, data.value)} />
  );
}
