/**
 * Interactive API Documentation Page
 * Renders the OpenAPI spec with Scalar API Reference viewer
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Documentation — ConTigo Platform',
  description: 'Interactive API reference for the ConTigo Contract Intelligence Platform',
};

export default function ApiDocsPage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>ConTigo API Documentation</title>
      </head>
      <body>
        <div
          id="api-reference"
          data-url="/api/docs/openapi"
          data-configuration={JSON.stringify({
            theme: 'kepler',
            layout: 'modern',
            darkMode: true,
            hiddenClients: [],
            defaultHttpClient: {
              targetKey: 'javascript',
              clientKey: 'fetch',
            },
            metaData: {
              title: 'ConTigo API Reference',
              description: 'AI-powered contract intelligence platform API',
            },
          })}
        />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest" />
      </body>
    </html>
  );
}
