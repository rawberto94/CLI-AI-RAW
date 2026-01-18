/**
 * Batch File Operations Service
 * 
 * Handles batch downloads, processing, and imports of contract files.
 * Optimizes throughput with parallel processing and chunking.
 */

import { Readable } from "stream";
import { createWriteStream, promises as fs } from "fs";
import path from "path";
import os from "os";
import archiver from "archiver";
import { ContractFile, ContractSource } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createConnector } from "../connectors/factory";
import { BaseConnector } from "../connectors/base.connector";

export interface BatchOperationOptions {
  concurrency?: number;
  chunkSize?: number;
  tempDir?: string;
  onProgress?: (progress: BatchProgress) => void;
  onError?: (error: BatchError) => void;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  currentFile?: string;
  bytesDownloaded: number;
  bytesTotal: number;
}

export interface BatchError {
  fileId: string;
  fileName: string;
  error: string;
}

export interface BatchResult {
  success: boolean;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  errors: BatchError[];
  outputPath?: string;
  duration: number;
}

export interface BatchDownloadRequest {
  sourceId: string;
  fileIds: string[];
  format: "zip" | "individual";
  includeMetadata?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<BatchOperationOptions, "onProgress" | "onError">> = {
  concurrency: 5,
  chunkSize: 10,
  tempDir: os.tmpdir(),
};

/**
 * Batch download files from a contract source
 */
export async function batchDownload(
  request: BatchDownloadRequest,
  tenantId: string,
  options: BatchOperationOptions = {}
): Promise<BatchResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: BatchError[] = [];

  // Get source and verify access
  const source = await prisma.contractSource.findFirst({
    where: { id: request.sourceId, tenantId },
  });

  if (!source) {
    throw new Error("Contract source not found");
  }

  // Get files to download
  const files = await prisma.contractFile.findMany({
    where: {
      id: { in: request.fileIds },
      contractSourceId: source.id,
    },
  });

  if (files.length === 0) {
    return {
      success: true,
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      errors: [],
      duration: Date.now() - startTime,
    };
  }

  // Create connector
  const connector = await createConnector(source);
  
  // Create temp directory for downloads
  const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const batchDir = path.join(opts.tempDir, batchId);
  await fs.mkdir(batchDir, { recursive: true });

  const progress: BatchProgress = {
    total: files.length,
    completed: 0,
    failed: 0,
    bytesDownloaded: 0,
    bytesTotal: files.reduce((sum, f) => sum + (f.size || 0), 0),
  };

  try {
    // Process files in chunks
    const chunks = chunkArray(files, opts.chunkSize);
    
    for (const chunk of chunks) {
      await processChunk(
        chunk,
        connector,
        batchDir,
        progress,
        errors,
        opts
      );
    }

    // Create output based on format
    let outputPath: string | undefined;
    
    if (request.format === "zip") {
      outputPath = await createZipArchive(
        batchDir,
        files,
        request.includeMetadata
      );
    } else {
      outputPath = batchDir;
    }

    return {
      success: errors.length === 0,
      totalFiles: files.length,
      processedFiles: progress.completed,
      failedFiles: progress.failed,
      errors,
      outputPath,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    // Cleanup on error
    await fs.rm(batchDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

/**
 * Process a chunk of files with parallel downloads
 */
async function processChunk(
  files: ContractFile[],
  connector: BaseConnector,
  outputDir: string,
  progress: BatchProgress,
  errors: BatchError[],
  options: BatchOperationOptions
): Promise<void> {
  const { concurrency = 5, onProgress, onError } = options;
  
  const downloadPromises = files.map(async (file) => {
    progress.currentFile = file.name;
    onProgress?.(progress);

    try {
      const content = await connector.downloadFile(file.remotePath);
      
      // Sanitize filename
      const safeName = sanitizeFilename(file.name);
      const filePath = path.join(outputDir, safeName);
      
      // Write to file
      await writeStreamToFile(content, filePath);
      
      progress.completed++;
      progress.bytesDownloaded += file.size || 0;
      onProgress?.(progress);
    } catch (error) {
      const batchError: BatchError = {
        fileId: file.id,
        fileName: file.name,
        error: error instanceof Error ? error.message : "Unknown error",
      };
      
      errors.push(batchError);
      progress.failed++;
      onError?.(batchError);
      onProgress?.(progress);
    }
  });

  // Process with concurrency limit
  await pLimit(downloadPromises, concurrency);
}

/**
 * Create a ZIP archive from downloaded files
 */
async function createZipArchive(
  sourceDir: string,
  files: ContractFile[],
  includeMetadata?: boolean
): Promise<string> {
  const zipPath = `${sourceDir}.zip`;
  const output = createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 6 } });

  return new Promise((resolve, reject) => {
    output.on("close", () => resolve(zipPath));
    archive.on("error", reject);

    archive.pipe(output);

    // Add files
    const dirFiles = require("fs").readdirSync(sourceDir);
    for (const filename of dirFiles) {
      const filePath = path.join(sourceDir, filename);
      archive.file(filePath, { name: filename });
    }

    // Add metadata file if requested
    if (includeMetadata) {
      const metadata = files.map((f) => ({
        id: f.id,
        name: f.name,
        remotePath: f.remotePath,
        size: f.size,
        mimeType: f.mimeType,
        syncedAt: f.syncedAt,
        remoteModifiedAt: f.remoteModifiedAt,
      }));
      
      archive.append(JSON.stringify(metadata, null, 2), {
        name: "_metadata.json",
      });
    }

    archive.finalize();
  });
}

/**
 * Batch import files to create contracts
 */
export async function batchImport(
  sourceId: string,
  fileIds: string[],
  tenantId: string,
  userId: string,
  options: BatchOperationOptions = {}
): Promise<BatchResult> {
  const startTime = Date.now();
  const errors: BatchError[] = [];

  // Get source and files
  const source = await prisma.contractSource.findFirst({
    where: { id: sourceId, tenantId },
  });

  if (!source) {
    throw new Error("Contract source not found");
  }

  const files = await prisma.contractFile.findMany({
    where: {
      id: { in: fileIds },
      contractSourceId: sourceId,
      contractId: null, // Only unlinked files
    },
  });

  const progress: BatchProgress = {
    total: files.length,
    completed: 0,
    failed: 0,
    bytesDownloaded: 0,
    bytesTotal: 0,
  };

  // Create contracts for each file
  for (const file of files) {
    progress.currentFile = file.name;
    options.onProgress?.(progress);

    try {
      // Create a contract from the file
      await prisma.contract.create({
        data: {
          title: path.basename(file.name, path.extname(file.name)),
          status: "DRAFT",
          tenantId,
          createdById: userId,
          documents: {
            create: {
              name: file.name,
              fileUrl: file.localPath || file.remotePath,
              mimeType: file.mimeType || "application/octet-stream",
              size: file.size || 0,
              uploadedById: userId,
            },
          },
        },
      });

      // Link the file to the contract
      await prisma.contractFile.update({
        where: { id: file.id },
        data: { status: "IMPORTED" },
      });

      progress.completed++;
    } catch (error) {
      const batchError: BatchError = {
        fileId: file.id,
        fileName: file.name,
        error: error instanceof Error ? error.message : "Unknown error",
      };
      
      errors.push(batchError);
      progress.failed++;
      options.onError?.(batchError);
    }

    options.onProgress?.(progress);
  }

  return {
    success: errors.length === 0,
    totalFiles: files.length,
    processedFiles: progress.completed,
    failedFiles: progress.failed,
    errors,
    duration: Date.now() - startTime,
  };
}

/**
 * Delete batch of files from source
 */
export async function batchDelete(
  sourceId: string,
  fileIds: string[],
  tenantId: string
): Promise<BatchResult> {
  const startTime = Date.now();

  // Verify source access
  const source = await prisma.contractSource.findFirst({
    where: { id: sourceId, tenantId },
  });

  if (!source) {
    throw new Error("Contract source not found");
  }

  // Delete files
  const result = await prisma.contractFile.deleteMany({
    where: {
      id: { in: fileIds },
      contractSourceId: sourceId,
    },
  });

  return {
    success: true,
    totalFiles: fileIds.length,
    processedFiles: result.count,
    failedFiles: fileIds.length - result.count,
    errors: [],
    duration: Date.now() - startTime,
  };
}

// Utility functions

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function pLimit<T>(promises: Promise<T>[], limit: number): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const promise of promises) {
    const p = Promise.resolve(promise).then((result) => {
      results.push(result);
    });
    
    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((e) => e === p),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 255);
}

async function writeStreamToFile(stream: Readable, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const writeStream = createWriteStream(filePath);
    stream.pipe(writeStream);
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    stream.on("error", reject);
  });
}

export default {
  batchDownload,
  batchImport,
  batchDelete,
};
