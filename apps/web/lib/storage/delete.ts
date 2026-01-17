/**
 * Storage Deletion Service
 * Handles deletion of contract files from various storage providers
 */

import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

interface StorageConfig {
  provider: 'local' | 's3' | 'minio'
  bucket?: string
  endpoint?: string
  region?: string
}

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    const endpoint = process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT
    const region = process.env.AWS_REGION || 'us-east-1'
    
    s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.MINIO_ACCESS_KEY || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.MINIO_SECRET_KEY || '',
      },
      forcePathStyle: !!endpoint, // Required for MinIO
    })
  }
  
  return s3Client
}

/**
 * Delete a contract file from storage
 */
export async function deleteContractFile(
  storagePath: string,
  provider?: StorageConfig['provider']
): Promise<{ success: boolean; error?: string }> {
  try {
    const storageProvider = provider || (process.env.STORAGE_PROVIDER as StorageConfig['provider']) || 'local'

    if (storageProvider === 's3' || storageProvider === 'minio') {
      // Delete from S3/MinIO
      const bucket = process.env.S3_BUCKET || process.env.MINIO_BUCKET
      
      if (!bucket) {
        throw new Error('S3/MinIO bucket not configured')
      }

      const s3 = getS3Client()
      
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: storagePath,
        })
      )

      return { success: true }
    } else {
      // Delete from local filesystem
      const uploadsDir = process.env.UPLOADS_DIR || 'uploads'
      const fullPath = join(process.cwd(), uploadsDir, storagePath)

      if (existsSync(fullPath)) {
        await unlink(fullPath)
        return { success: true }
      } else {
        return { success: true } // Not an error if file doesn't exist
      }
    }
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete multiple contract files (batch operation)
 */
export async function deleteContractFiles(
  storagePaths: string[],
  provider?: StorageConfig['provider']
): Promise<{
  total: number
  deleted: number
  failed: number
  errors: Array<{ path: string; error: string }>
}> {
  const results = await Promise.allSettled(
    storagePaths.map((path) => deleteContractFile(path, provider))
  )

  const deleted = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
  const failed = results.length - deleted
  const errors = results
    .map((r, i) => ({
      path: storagePaths[i],
      result: r,
    }))
    .filter((item) => item.result.status === 'rejected' || !item.result.value.success)
    .map((item) => ({
      path: item.path,
      error:
        item.result.status === 'rejected'
          ? item.result.reason.message
          : item.result.value.error || 'Unknown error',
    }))

  return {
    total: storagePaths.length,
    deleted,
    failed,
    errors,
  }
}

/**
 * Check if storage is configured and accessible
 */
export async function testStorageConnection(): Promise<{
  connected: boolean
  provider: string
  error?: string
}> {
  try {
    const provider = (process.env.STORAGE_PROVIDER as StorageConfig['provider']) || 'local'

    if (provider === 's3' || provider === 'minio') {
      const bucket = process.env.S3_BUCKET || process.env.MINIO_BUCKET
      
      if (!bucket) {
        throw new Error('Bucket not configured')
      }

      const s3 = getS3Client()
      
      // Test connection by attempting to list objects (limit 1)
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: '_health_check_test_',
        })
      )

      return { connected: true, provider }
    } else {
      // Check local filesystem
      const uploadsDir = process.env.UPLOADS_DIR || 'uploads'
      const fullPath = join(process.cwd(), uploadsDir)

      if (!existsSync(fullPath)) {
        throw new Error(`Uploads directory does not exist: ${fullPath}`)
      }

      return { connected: true, provider: 'local' }
    }
  } catch (error) {
    return {
      connected: false,
      provider: process.env.STORAGE_PROVIDER || 'local',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
