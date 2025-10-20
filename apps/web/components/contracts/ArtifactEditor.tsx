'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, X, AlertCircle, CheckCircle } from 'lucide-react';

interface ArtifactEditorProps {
  artifact: any;
  contractId: string;
  onSave?: (updatedArtifact: any) => void;
  onCancel?: () => void;
}

export function ArtifactEditor({
  artifact,
  contractId,
  onSave,
  onCancel,
}: ArtifactEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedData, setEditedData] = useState(artifact.data);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFieldChange = (fieldPath: string, value: any) => {
    setEditedData((prev: any) => {
      const newData = { ...prev };
      const keys = fieldPath.split('.');
      let current = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(
        `/api/contracts/${contractId}/artifacts/${artifact.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates: editedData,
            userId: 'current-user', // TODO: Get from auth context
            reason: 'Manual edit via UI',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save artifact');
      }

      const result = await response.json();
      setSuccess(true);
      setIsEditing(false);
      
      if (onSave) {
        onSave(result.artifact);
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedData(artifact.data);
    setIsEditing(false);
    setError(null);
    if (onCancel) {
      onCancel();
    }
  };

  const renderField = (key: string, value: any, path: string = '') => {
    const fullPath = path ? `${path}.${key}` : key;

    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div key={fullPath} className="space-y-2 pl-4 border-l-2 border-gray-200">
          <Label className="text-sm font-semibold text-gray-700">{key}</Label>
          {Object.entries(value).map(([k, v]) => renderField(k, v, fullPath))}
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={fullPath} className="space-y-2">
          <Label className="text-sm font-semibold text-gray-700">{key}</Label>
          <div className="text-sm text-gray-600">
            {value.length} items (array editing not yet supported)
          </div>
        </div>
      );
    }

    return (
      <div key={fullPath} className="space-y-1">
        <Label htmlFor={fullPath} className="text-sm text-gray-700">
          {key}
        </Label>
        {isEditing ? (
          <Input
            id={fullPath}
            value={value?.toString() || ''}
            onChange={(e) => handleFieldChange(fullPath, e.target.value)}
            className="w-full"
          />
        ) : (
          <div className="text-sm text-gray-900 p-2 bg-gray-50 rounded">
            {value?.toString() || '-'}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {artifact.type} Artifact
          </h3>
          {artifact.isEdited && (
            <p className="text-sm text-gray-500">
              Last edited {new Date(artifact.lastEditedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
              >
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
            </>
          )}
        </div>
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
            Artifact saved successfully!
          </AlertDescription>
        </Alert>
      )}

      {/* Fields */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto p-4 border rounded-lg">
        {Object.entries(editedData).map(([key, value]) =>
          renderField(key, value)
        )}
      </div>

      {/* Validation Status */}
      {artifact.validationStatus && artifact.validationStatus !== 'valid' && (
        <Alert variant={artifact.validationStatus === 'error' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {artifact.validationStatus === 'error'
              ? 'This artifact has validation errors'
              : 'This artifact has validation warnings'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
