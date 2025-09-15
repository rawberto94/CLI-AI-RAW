/**
 * Repository Connector API Routes
 * External repository integration endpoints
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../errors';

// Validation schemas
const repositoryConfigSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  type: z.enum(['sharepoint', 'onedrive', 'googledrive', 'box', 'dropbox', 'network-share']),
  credentials: z.object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    tenantId: z.string().optional(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    apiKey: z.string().optional(),
    path: z.string().optional()
  }).default({}),
  settings: z.object({
    syncEnabled: z.boolean().default(true),
    syncInterval: z.number().min(5).max(10080).default(60), // 5 minutes to 1 week
    autoIndex: z.boolean().default(true),
    includePatterns: z.array(z.string()).default([]),
    excludePatterns: z.array(z.string()).default(['~*', '.tmp', '.temp']),
    maxFileSize: z.number().min(1024).max(100 * 1024 * 1024).default(10 * 1024 * 1024), // 1KB to 100MB
    supportedTypes: z.array(z.string()).default([
      'application/pdf',
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ])
  }).default({})
});

// In-memory repository store (replace with database in production)
const repositories = new Map<string, any>();
const syncOperations = new Map<string, any>();

export function registerRepositoryRoutes(fastify: FastifyInstance) {
  
  /**
   * List all repositories
   */
  fastify.get('/api/repositories', async () => {
    const repos = Array.from(repositories.values()).map(repo => ({
      ...repo,
      credentials: {
        // Only show non-sensitive fields
        path: repo.credentials?.path,
        hasClientId: !!repo.credentials?.clientId,
        hasAccessToken: !!repo.credentials?.accessToken,
        hasApiKey: !!repo.credentials?.apiKey
      }
    }));
    
    return { repositories: repos };
  });

  /**
   * Get specific repository
   */
  fastify.get('/api/repositories/:id', async (request) => {
    const { id } = request.params as { id: string };
    
    const repository = repositories.get(id);
    if (!repository) {
      throw new AppError(404, 'Repository not found');
    }
    
    // Sanitize credentials
    const sanitized = {
      ...repository,
      credentials: {
        path: repository.credentials?.path,
        hasClientId: !!repository.credentials?.clientId,
        hasAccessToken: !!repository.credentials?.accessToken,
        hasApiKey: !!repository.credentials?.apiKey
      }
    };
    
    return { repository: sanitized };
  });

  /**
   * Add new repository
   */
  fastify.post('/api/repositories', async (request, reply) => {
    try {
      const parsed = repositoryConfigSchema.parse(request.body);
      const config = {
        ...parsed,
        status: 'active',
        createdAt: new Date(),
        lastSync: null
      };
      
      repositories.set(config.id, config);
      
      return reply.code(201).send({ 
        message: 'Repository added successfully',
        repositoryId: config.id 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid repository configuration', true, {
          validationErrors: error.errors
        });
      }
      throw new AppError(500, `Failed to add repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  /**
   * Update repository
   */
  fastify.put('/api/repositories/:id', async (request) => {
    const { id } = request.params as { id: string };
    
    const repository = repositories.get(id);
    if (!repository) {
      throw new AppError(404, 'Repository not found');
    }

    try {
      const updates = repositoryConfigSchema.partial().parse(request.body);
      const updated = { ...repository, ...updates, updatedAt: new Date() };
      repositories.set(id, updated);
      
      return { message: 'Repository updated successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid repository configuration', true, {
          validationErrors: error.errors
        });
      }
      throw new AppError(500, `Failed to update repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  /**
   * Delete repository
   */
  fastify.delete('/api/repositories/:id', async (request) => {
    const { id } = request.params as { id: string };
    
    if (!repositories.has(id)) {
      throw new AppError(404, 'Repository not found');
    }
    
    repositories.delete(id);
    return { message: 'Repository deleted successfully' };
  });

  /**
   * Test repository connection
   */
  fastify.post('/api/repositories/:id/test', async (request) => {
    const { id } = request.params as { id: string };
    
    const repository = repositories.get(id);
    if (!repository) {
      throw new AppError(404, 'Repository not found');
    }

    // Mock connection test - replace with actual implementation
    const isConnected = Math.random() > 0.3; // 70% success rate for demo
    
    return { 
      connected: isConnected,
      message: isConnected ? 'Connection successful' : 'Connection failed'
    };
  });

  /**
   * Start repository synchronization
   */
  fastify.post('/api/repositories/:id/sync', async (request) => {
    const { id } = request.params as { id: string };
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    
    const repository = repositories.get(id);
    if (!repository) {
      throw new AppError(404, 'Repository not found');
    }

    const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    syncOperations.set(syncId, {
      id: syncId,
      repositoryId: id,
      tenantId,
      status: 'running',
      startedAt: new Date(),
      progress: 0,
      totalFiles: 0,
      processedFiles: 0,
      errors: []
    });

    // Mock sync operation - replace with actual implementation
    setTimeout(() => {
      const sync = syncOperations.get(syncId);
      if (sync) {
        sync.status = 'completed';
        sync.completedAt = new Date();
        sync.progress = 100;
        sync.totalFiles = Math.floor(Math.random() * 50) + 10;
        sync.processedFiles = sync.totalFiles;
        syncOperations.set(syncId, sync);
      }
    }, 5000);
    
    return { 
      message: 'Synchronization started',
      syncId 
    };
  });

  /**
   * Get synchronization status
   */
  fastify.get('/api/repositories/sync/:syncId', async (request) => {
    const { syncId } = request.params as { syncId: string };
    
    const status = syncOperations.get(syncId);
    if (!status) {
      throw new AppError(404, 'Sync operation not found');
    }
    
    return { sync: status };
  });

  /**
   * Get repository templates/presets
   */
  fastify.get('/api/repositories/templates', async () => {
    return {
      templates: [
        {
          id: 'sharepoint-contracts',
          name: 'SharePoint Contracts Folder',
          type: 'sharepoint',
          description: 'Connect to a SharePoint document library containing contracts',
          settings: {
            syncEnabled: true,
            syncInterval: 60,
            autoIndex: true,
            includePatterns: ['*.pdf', '*.docx', '*.doc'],
            excludePatterns: ['~*', '.tmp', '_archive/*'],
            maxFileSize: 50 * 1024 * 1024,
            supportedTypes: [
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ]
          }
        },
        {
          id: 'googledrive-legal',
          name: 'Google Drive Legal Documents',
          type: 'googledrive',
          description: 'Connect to Google Drive folder with legal documents',
          settings: {
            syncEnabled: true,
            syncInterval: 120,
            autoIndex: true,
            includePatterns: ['*.pdf', '*.docx'],
            excludePatterns: ['draft/*', 'archive/*'],
            maxFileSize: 25 * 1024 * 1024,
            supportedTypes: [
              'application/pdf',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ]
          }
        }
      ]
    };
  });
}