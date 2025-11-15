/**
 * Scenario Modeling Component Stub
 */

import React from 'react';

export interface ScenarioModelingProps {
  className?: string;
}

export function ScenarioModeling({ className }: ScenarioModelingProps) {
  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-4">Scenario Modeling</h3>
      <div className="space-y-4">
        <div className="p-4 border rounded">
          <p>Create and compare different scenarios</p>
        </div>
      </div>
    </div>
  );
}

export default ScenarioModeling;
