/**
 * Drafts Panel — View, load, and manage saved contract drafts.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
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
  Spinner,
  Input,
  Field,
  Badge,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  MessageBar,
  MessageBarBody,
  Tooltip,
  Menu,
  MenuTrigger,
  MenuList,
  MenuItem,
  MenuPopover,
} from '@fluentui/react-components';
import {
  NoteRegular,
  SearchRegular,
  ArrowDownloadRegular,
  DeleteRegular,
  MoreHorizontalRegular,
  DocumentRegular,
  SaveRegular,
} from '../../utils/icons';
import { apiClient } from '../../services/api-client';
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
  },
  searchInput: {
    maxWidth: '280px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  card: {
    cursor: 'pointer',
    transition: 'box-shadow 0.2s',
    ':hover': {
      boxShadow: tokens.shadow8,
    },
  },
  cardRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  meta: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    paddingLeft: tokens.spacingHorizontalM,
    paddingBottom: tokens.spacingVerticalS,
  },
});

interface Draft {
  id: string;
  title: string;
  templateName: string;
  updatedAt: string;
  status: string;
}

export const DraftsPanel: React.FC = () => {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Draft | null>(null);
  const [loadingDraftId, setLoadingDraftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');

  // Fetch drafts (using the templates/generate-created drafts)
  const { data: drafts, isLoading } = useQuery({
    queryKey: ['addin-drafts'],
    queryFn: async () => {
      const result = await apiClient.getContractDrafts();
      if (result.success && result.data) return result.data as Draft[];
      throw new Error(result.error?.message || 'Failed to fetch drafts');
    },
  });

  const filteredDrafts = (drafts || []).filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.deleteContractDraft(id);
      if (!result.success) throw new Error(result.error?.message || 'Delete failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addin-drafts'] });
      setDeleteTarget(null);
    },
  });

  // Load a draft's content into the current Word document
  const handleLoadDraft = useCallback(async (draft: Draft) => {
    setLoadingDraftId(draft.id);
    setError(null);
    try {
      // Fetch the full draft content
      const result = await apiClient.loadContractDraft(draft.id);
      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to load draft');
      }

      // Insert into Word
      await wordService.insertHtml(result.data.content, 'end');

      // Replace variable placeholders if any
      if (result.data.variables && typeof result.data.variables === 'object') {
        const variables = Object.entries(result.data.variables as Record<string, string>).map(([name, value]) => ({
          name,
          value,
          placeholder: `{{${name}}}`,
        }));
        if (variables.length > 0) {
          await wordService.replaceVariables(variables);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load draft');
    } finally {
      setLoadingDraftId(null);
    }
  }, []);

  // Save current document as a new draft
  const handleSaveCurrentDoc = useCallback(async () => {
    if (!saveTitle.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const html = await wordService.getDocumentAsBase64(); // gets OOXML base64
      const result = await apiClient.saveContractDraft({
        title: saveTitle,
        content: html,
        variables: {},
      });
      if (!result.success) throw new Error(result.error?.message || 'Save failed');
      queryClient.invalidateQueries({ queryKey: ['addin-drafts'] });
      setSaveSuccess(true);
      setShowSave(false);
      setSaveTitle('');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  }, [saveTitle, queryClient]);

  const statusColor = (status: string): 'brand' | 'success' | 'warning' | 'informative' => {
    switch (status) {
      case 'completed': return 'success';
      case 'review': return 'warning';
      case 'approved': return 'success';
      default: return 'informative';
    }
  };

  if (isLoading) {
    return <div className={styles.loading}><Spinner label="Loading drafts..." /></div>;
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Title2>Drafts</Title2>
        <Tooltip content="Save current document as a draft" relationship="label">
          <Button icon={<SaveRegular />} appearance="primary" size="small" onClick={() => setShowSave(true)}>
            Save Doc
          </Button>
        </Tooltip>
      </div>

      {saveSuccess && (
        <MessageBar intent="success">
          <MessageBarBody>Document saved as draft!</MessageBarBody>
        </MessageBar>
      )}

      <Input
        className={styles.searchInput}
        contentBefore={<SearchRegular />}
        placeholder="Search drafts..."
        value={search}
        onChange={(_, data) => setSearch(data.value)}
        size="small"
      />

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <Caption1>{filteredDrafts.length} draft{filteredDrafts.length !== 1 ? 's' : ''}</Caption1>

      {filteredDrafts.length > 0 ? (
        <div className={styles.list}>
          {filteredDrafts.map((draft) => (
            <Card key={draft.id} className={styles.card}>
              <div className={styles.cardRow}>
                <CardHeader
                  image={<NoteRegular fontSize={24} />}
                  header={<Body2 style={{ fontWeight: 600 }}>{draft.title}</Body2>}
                  description={
                    <Caption1>
                      {new Date(draft.updatedAt).toLocaleDateString()} &bull;{' '}
                      {draft.templateName || 'No template'}
                    </Caption1>
                  }
                />
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <Button
                    icon={loadingDraftId === draft.id ? <Spinner size="tiny" /> : <ArrowDownloadRegular />}
                    appearance="subtle"
                    size="small"
                    onClick={() => handleLoadDraft(draft)}
                    disabled={!!loadingDraftId}
                    title="Load into document"
                  />
                  <Menu>
                    <MenuTrigger>
                      <Button icon={<MoreHorizontalRegular />} appearance="subtle" size="small" />
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList>
                        <MenuItem icon={<DeleteRegular />} onClick={() => setDeleteTarget(draft)}>
                          Delete
                        </MenuItem>
                      </MenuList>
                    </MenuPopover>
                  </Menu>
                </div>
              </div>
              <div className={styles.meta}>
                <Badge appearance="outline" color={statusColor(draft.status)} size="small">
                  {draft.status}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <DocumentRegular fontSize={48} />
          <Body1>No drafts yet</Body1>
          <Caption1>Generate a contract from a template to create your first draft.</Caption1>
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(_, data) => { if (!data.open) setDeleteTarget(null); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete Draft</DialogTitle>
            <DialogContent>
              <Body1>Are you sure you want to delete <strong>{deleteTarget?.title}</strong>?</Body1>
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

      {/* Save Current Document Dialog */}
      <Dialog open={showSave} onOpenChange={(_, data) => { if (!data.open) setShowSave(false); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Save Current Document as Draft</DialogTitle>
            <DialogContent>
              <Field label="Draft Title" required>
                <Input
                  value={saveTitle}
                  onChange={(_, data) => setSaveTitle(data.value)}
                  placeholder="e.g. NDA - Acme Corp v2"
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setShowSave(false)}>Cancel</Button>
              <Button
                appearance="primary"
                onClick={handleSaveCurrentDoc}
                disabled={!saveTitle.trim() || isSaving}
              >
                {isSaving ? <Spinner size="tiny" /> : 'Save Draft'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
