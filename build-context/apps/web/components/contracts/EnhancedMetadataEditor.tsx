'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, Plus, Save, Loader2, AlertCircle, CheckCircle, Tag } from 'lucide-react';

interface EnhancedMetadataEditorProps {
  contractId: string;
  tenantId: string;
  initialMetadata?: any;
  onSave?: () => void;
}

export function EnhancedMetadataEditor({
  contractId,
  tenantId,
  initialMetadata,
  onSave,
}: EnhancedMetadataEditorProps) {
  const [tags, setTags] = useState<string[]>(initialMetadata?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<Record<string, any>>(
    initialMetadata?.customFields || {}
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (newTag.length > 1) {
      loadTagSuggestions(newTag);
    } else {
      setTagSuggestions([]);
    }
  }, [newTag]);

  const loadTagSuggestions = async (query: string) => {
    try {
      // Call tag autocomplete API
      const response = await fetch(
        `/api/contracts/tags/suggest?q=${encodeURIComponent(query)}&tenantId=${tenantId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setTagSuggestions(data.suggestions || []);
      } else {
        // Fallback to smart suggestions based on query
        setTagSuggestions([
          `${query}-consulting`,
          `${query}-services`,
          `${query}-contract`,
        ]);
      }
    } catch {
      // Failed to load tag suggestions - show fallback
      setTagSuggestions([
        `${query}-consulting`,
        `${query}-services`,
        `${query}-contract`,
      ]);
    }
  };

  const handleAddTag = (tag: string) => {
    const normalizedTag = tag.toLowerCase().replace(/\s+/g, '-');
    
    if (!normalizedTag) {
      setError('Tag cannot be empty');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(normalizedTag)) {
      setError('Tags must be lowercase alphanumeric with hyphens');
      return;
    }

    if (tags.includes(normalizedTag)) {
      setError('Tag already exists');
      return;
    }

    setTags([...tags, normalizedTag]);
    setNewTag('');
    setTagSuggestions([]);
    setError(null);
  };

  const handleRemoveTag = async (tag: string) => {
    try {
      const response = await fetch(
        `/api/contracts/${contractId}/metadata/tags/${encodeURIComponent(tag)}?tenantId=${tenantId}&userId=current-user`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to remove tag');
      }

      setTags(tags.filter(t => t !== tag));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove tag');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Save tags
      const response = await fetch(
        `/api/contracts/${contractId}/metadata/tags`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tags,
            tenantId,
            userId: 'current-user',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save metadata');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      if (onSave) {
        onSave();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCustomFieldChange = (fieldName: string, value: any) => {
    setCustomFields({
      ...customFields,
      [fieldName]: value,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Contract Metadata</h3>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save
            </>
          )}
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Metadata saved successfully!
          </AlertDescription>
        </Alert>
      )}

      {/* Tags Section */}
      <div className="space-y-3">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Tag className="w-4 h-4" />
          Tags
        </Label>
        
        {/* Existing Tags */}
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="px-3 py-1 flex items-center gap-2"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {tags.length === 0 && (
            <span className="text-sm text-gray-500">No tags yet</span>
          )}
        </div>

        {/* Add New Tag */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag(newTag);
                }
              }}
              placeholder="Add a tag (e.g., consulting, it-services)"
              className="flex-1"
            />
            <Button
              onClick={() => handleAddTag(newTag)}
              disabled={!newTag}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Tag Suggestions */}
          {tagSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-500">Suggestions:</span>
              {tagSuggestions.map((suggestion) => (
                <Badge
                  key={suggestion}
                  variant="outline"
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleAddTag(suggestion)}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom Fields Section */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Custom Fields</Label>
        
        <div className="space-y-3">
          {Object.entries(customFields).map(([fieldName, value]) => (
            <div key={fieldName} className="space-y-1">
              <Label htmlFor={fieldName} className="text-sm">
                {fieldName}
              </Label>
              <Input
                id={fieldName}
                value={value?.toString() || ''}
                onChange={(e) => handleCustomFieldChange(fieldName, e.target.value)}
              />
            </div>
          ))}
          
          {Object.keys(customFields).length === 0 && (
            <span className="text-sm text-gray-500">
              No custom fields defined
            </span>
          )}
        </div>
      </div>

      {/* Data Quality Score */}
      {initialMetadata?.dataQualityScore !== undefined && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Data Quality Score</span>
            <Badge
              variant={
                initialMetadata.dataQualityScore >= 80
                  ? 'default'
                  : initialMetadata.dataQualityScore >= 60
                  ? 'secondary'
                  : 'destructive'
              }
            >
              {initialMetadata.dataQualityScore}/100
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
