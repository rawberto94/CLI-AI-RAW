import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="mb-4 text-gray-400">{icon}</div>}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4 max-w-sm">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}

export function NoContracts() {
  return (
    <EmptyState
      title="No contracts found"
      description="Upload your first contract to get started with analysis and insights."
    />
  );
}

export function NoResults() {
  return (
    <EmptyState
      title="No results found"
      description="Try adjusting your search or filter criteria."
    />
  );
}

export function NoContractsEmptyState() {
  return <NoContracts />;
}

export function NoFilterResultsEmptyState() {
  return <NoResults />;
}
