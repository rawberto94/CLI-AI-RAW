'use client';

/**
 * TemplateVariableForm
 *
 * Extracts {{variable}} placeholders from template content and presents
 * a fill-in form. Once completed, injects the values into the content
 * and returns the hydrated HTML string.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, FileText, AlertCircle, Variable } from 'lucide-react';

interface TemplateVariable {
  name: string;
  label: string;
  placeholder: string;
  required: boolean;
}

interface TemplateVariableFormProps {
  templateContent: string;
  templateName: string;
  onComplete: (hydratedContent: string, variables: Record<string, string>) => void;
  onSkip: () => void;
}

/** Extract all unique {{variable_name}} tokens from HTML/text */
function extractVariables(content: string): TemplateVariable[] {
  const regex = /\{\{([a-zA-Z0-9_\- ]+)\}\}/g;
  const seen = new Set<string>();
  const vars: TemplateVariable[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const raw = match[1].trim();
    if (seen.has(raw)) continue;
    seen.add(raw);

    const label = raw
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    vars.push({
      name: raw,
      label,
      placeholder: `Enter ${label.toLowerCase()}...`,
      required: true,
    });
  }
  return vars;
}

/** Inject values back into template content */
function hydrateContent(content: string, values: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(values)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g'), value || `{{${key}}}`);
  }
  return result;
}

export function TemplateVariableForm({
  templateContent,
  templateName,
  onComplete,
  onSkip,
}: TemplateVariableFormProps) {
  const variables = useMemo(() => extractVariables(templateContent), [templateContent]);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    variables.forEach((v) => { init[v.name] = ''; });
    return init;
  });

  const filledCount = useMemo(
    () => Object.values(values).filter((v) => v.trim().length > 0).length,
    [values],
  );

  const allFilled = filledCount === variables.length;

  const handleChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const hydrated = hydrateContent(templateContent, values);
      onComplete(hydrated, values);
    },
    [templateContent, values, onComplete],
  );

  if (variables.length === 0) {
    // No variables to fill — pass through immediately
    onComplete(templateContent, {});
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto py-12 px-4"
    >
      <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
          <Variable className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
          Fill Template Variables
        </h2>
        <p className="text-gray-500 dark:text-slate-400 mt-2">
          Complete the fields below to personalize <span className="font-medium text-violet-600 dark:text-violet-400">{templateName}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm divide-y divide-gray-100 dark:divide-slate-700">
          {variables.map((v, idx) => (
            <div key={v.name} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <label
                htmlFor={`var-${v.name}`}
                className="text-sm font-medium text-gray-700 dark:text-slate-200 sm:w-44 flex-shrink-0 flex items-center gap-2"
              >
                <span className="text-xs text-violet-500 font-mono bg-violet-50 dark:bg-violet-900/30 px-1.5 py-0.5 rounded">
                  {idx + 1}
                </span>
                {v.label}
              </label>
              <input
                id={`var-${v.name}`}
                type="text"
                value={values[v.name] || ''}
                onChange={(e) => handleChange(v.name, e.target.value)}
                placeholder={v.placeholder}
                autoFocus={idx === 0}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          ))}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-slate-400">
          <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300 rounded-full"
              style={{ width: `${(filledCount / variables.length) * 100}%` }}
            />
          </div>
          <span className="font-medium">{filledCount}/{variables.length} filled</span>
        </div>

        {!allFilled && (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4" />
            <span>Unfilled variables will remain as placeholders in the document.</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-colors font-medium shadow-lg shadow-violet-500/25"
          >
            <Sparkles className="h-4 w-4" />
            {allFilled ? 'Start Editing' : 'Continue with Placeholders'}
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-6 py-3 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-medium"
          >
            Skip
          </button>
        </div>
      </form>
    </motion.div>
  );
}

export default TemplateVariableForm;
