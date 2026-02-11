/**
 * Templates Panel - Browse and generate contracts from templates
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  makeStyles,
  tokens,
  Title2,
  Body1,
  Button,
  Card,
  CardHeader,
  CardPreview,
  Spinner,
  Input,
  Select,
  Badge,
  Divider,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Field,
  Textarea,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import {
  DocumentRegular,
  SearchRegular,
  AddRegular,
  ArrowDownloadRegular,
  EditRegular,
} from '@fluentui/react-icons';
import { apiClient, Template, TemplateVariable } from '../../services/api-client';
import { wordService } from '../../services/word-service';

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
  filters: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalM,
  },
  searchInput: {
    flex: 1,
    maxWidth: '200px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  card: {
    cursor: 'pointer',
    transition: 'box-shadow 0.2s',
    ':hover': {
      boxShadow: tokens.shadow16,
    },
  },
  cardPreview: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '80px',
  },
  categoryBadge: {
    marginTop: tokens.spacingVerticalXS,
  },
  variableForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    maxHeight: '400px',
    overflowY: 'auto',
    paddingRight: tokens.spacingHorizontalS,
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXL,
  },
  empty: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXL,
    color: tokens.colorNeutralForeground3,
  },
});

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'MSA', label: 'Master Service Agreement' },
  { value: 'SOW', label: 'Statement of Work' },
  { value: 'NDA', label: 'Non-Disclosure Agreement' },
  { value: 'AMENDMENT', label: 'Amendment' },
  { value: 'SLA', label: 'Service Level Agreement' },
  { value: 'OTHER', label: 'Other' },
];

export const TemplatesPanel: React.FC = () => {
  const styles = useStyles();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch templates
  const { data: templates, isLoading, error: fetchError } = useQuery({
    queryKey: ['templates', category],
    queryFn: async () => {
      const result = await apiClient.getTemplates(category || undefined);
      if (result.success) return result.data;
      throw new Error(result.error?.message || 'Failed to fetch templates');
    },
  });

  // Filter templates by search
  const filteredTemplates = templates?.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  // Handle template selection
  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template);
    // Initialize variable values with defaults
    const defaults: Record<string, string> = {};
    template.variables.forEach((v) => {
      defaults[v.name] = v.defaultValue || '';
    });
    setVariableValues(defaults);
    setError(null);
  }, []);

  // Handle variable change
  const handleVariableChange = useCallback((name: string, value: string) => {
    setVariableValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Generate contract
  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate) return;
    
    setIsGenerating(true);
    setError(null);

    try {
      // Check required variables
      const missingRequired = selectedTemplate.variables
        .filter((v) => v.required && !variableValues[v.name])
        .map((v) => v.label);
      
      if (missingRequired.length > 0) {
        setError(`Missing required fields: ${missingRequired.join(', ')}`);
        setIsGenerating(false);
        return;
      }

      // Call API to generate contract
      const result = await apiClient.generateContract({
        templateId: selectedTemplate.id,
        variables: variableValues,
        format: 'html', // Word can handle HTML well
      });

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Generation failed');
      }

      // Insert into Word document
      await wordService.insertHtml(result.data.content, 'end');

      // Replace variable placeholders
      const variables = Object.entries(variableValues).map(([name, value]) => ({
        name,
        value,
        placeholder: `{{${name}}}`,
      }));
      await wordService.replaceVariables(variables);

      // Close dialog
      setSelectedTemplate(null);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedTemplate, variableValues]);

  // Render loading state
  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spinner label="Loading templates..." />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <Title2>Contract Templates</Title2>
        <Button icon={<AddRegular />} appearance="subtle">
          New
        </Button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <Input
          className={styles.searchInput}
          contentBefore={<SearchRegular />}
          placeholder="Search templates..."
          value={search}
          onChange={(e, data) => setSearch(data.value)}
        />
        <Select
          value={category}
          onChange={(e, data) => setCategory(data.value)}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Error message */}
      {fetchError && (
        <MessageBar intent="error">
          <MessageBarBody>
            {fetchError instanceof Error ? fetchError.message : 'Failed to load templates'}
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Template grid */}
      {filteredTemplates && filteredTemplates.length > 0 ? (
        <div className={styles.grid}>
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className={styles.card}
              onClick={() => handleSelectTemplate(template)}
            >
              <CardPreview className={styles.cardPreview}>
                <DocumentRegular fontSize={40} />
              </CardPreview>
              <CardHeader
                header={<Body1 weight="semibold">{template.name}</Body1>}
                description={template.description}
              />
              <Badge
                className={styles.categoryBadge}
                appearance="outline"
                color="informative"
              >
                {template.category}
              </Badge>
            </Card>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <DocumentRegular fontSize={48} />
          <Body1>No templates found</Body1>
        </div>
      )}

      {/* Variable input dialog */}
      <Dialog
        open={!!selectedTemplate}
        onOpenChange={(e, data) => !data.open && setSelectedTemplate(null)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              Generate: {selectedTemplate?.name}
            </DialogTitle>
            <DialogContent>
              {error && (
                <MessageBar intent="error" style={{ marginBottom: 16 }}>
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
              
              <Body1 style={{ marginBottom: 16 }}>
                Fill in the contract variables:
              </Body1>
              
              <div className={styles.variableForm}>
                {selectedTemplate?.variables.map((variable) => (
                  <Field
                    key={variable.name}
                    label={`${variable.label}${variable.required ? ' *' : ''}`}
                    hint={variable.description}
                  >
                    {variable.type === 'select' && variable.options ? (
                      <Select
                        value={variableValues[variable.name] || ''}
                        onChange={(e, data) =>
                          handleVariableChange(variable.name, data.value)
                        }
                      >
                        <option value="">Select...</option>
                        {variable.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </Select>
                    ) : variable.type === 'date' ? (
                      <Input
                        type="date"
                        value={variableValues[variable.name] || ''}
                        onChange={(e, data) =>
                          handleVariableChange(variable.name, data.value)
                        }
                      />
                    ) : (
                      <Input
                        type={variable.type === 'number' ? 'number' : 'text'}
                        placeholder={variable.placeholder}
                        value={variableValues[variable.name] || ''}
                        onChange={(e, data) =>
                          handleVariableChange(variable.name, data.value)
                        }
                      />
                    )}
                  </Field>
                ))}
              </div>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setSelectedTemplate(null)}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                icon={<ArrowDownloadRegular />}
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? <Spinner size="tiny" /> : 'Generate Contract'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
