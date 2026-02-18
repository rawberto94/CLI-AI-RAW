/**
 * Contract Source Connector Tests
 *
 * Uses Vitest. Mocks are re-established in beforeEach because
 * vitest.config has mockReset: true which clears all mock implementations.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---- Module mocks (hoisted, factory called once) ----

vi.mock("@repo/db", () => ({ default: vi.fn(() => ({})) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("../google-drive", () => ({
  getGoogleDriveAuthUrl: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  refreshGoogleDriveToken: vi.fn(),
  getGoogleUserInfo: vi.fn(),
  listDriveFiles: vi.fn(),
  downloadDriveFile: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  ContractSourceProvider: {
    SHAREPOINT: "SHAREPOINT",
    ONEDRIVE: "ONEDRIVE",
    AZURE_BLOB: "AZURE_BLOB",
    AWS_S3: "AWS_S3",
    SFTP: "SFTP",
    FTP: "FTP",
    GOOGLE_DRIVE: "GOOGLE_DRIVE",
    DROPBOX: "DROPBOX",
    BOX: "BOX",
  },
  SyncMode: { FULL: "FULL", INCREMENTAL: "INCREMENTAL" },
}));

vi.mock("@azure/storage-blob", () => ({
  BlobServiceClient: vi.fn(),
  StorageSharedKeyCredential: vi.fn(),
  ContainerClient: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(),
  ListObjectsV2Command: vi.fn(),
  GetObjectCommand: vi.fn(),
  HeadBucketCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
}));

vi.mock("ssh2-sftp-client", () => ({
  default: vi.fn(),
}));

// ---- Imports (resolved against mocked modules) ----
import { BlobServiceClient } from "@azure/storage-blob";
import { S3Client } from "@aws-sdk/client-s3";
import SFTPClient from "ssh2-sftp-client";

import { AzureBlobConnector } from "../connectors/azure-blob.connector";
import { S3Connector } from "../connectors/s3.connector";
import { SFTPConnector } from "../connectors/sftp.connector";
import { createConnector } from "../connectors/factory";

// ============================================================
// Helper to build Azure Blob mock chain
// ============================================================
function setupAzureBlobMock() {
  const containerClient = {
    exists: vi.fn().mockResolvedValue(true),
    getProperties: vi.fn().mockResolvedValue({}),
    listBlobsFlat: vi.fn().mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          name: "test.pdf",
          properties: {
            contentLength: 1000,
            lastModified: new Date(),
            contentType: "application/pdf",
          },
        };
      },
    }),
    getBlobClient: vi.fn().mockReturnValue({
      exists: vi.fn().mockResolvedValue(true),
      download: vi.fn().mockResolvedValue({
        readableStreamBody: (async function* () {
          yield Buffer.from("test content");
        })(),
      }),
      getProperties: vi.fn().mockResolvedValue({
        contentType: "application/pdf",
        contentLength: 12,
      }),
    }),
    listBlobsByHierarchy: vi.fn().mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          kind: "blob",
          name: "test.pdf",
          properties: {
            contentLength: 1000,
            lastModified: new Date(),
            contentType: "application/pdf",
          },
        };
      },
    }),
  };

  const serviceClient = {
    getContainerClient: vi.fn().mockReturnValue(containerClient),
  };

  // Re-establish static method + constructor
  (BlobServiceClient as any).fromConnectionString = vi.fn().mockReturnValue(serviceClient);
  vi.mocked(BlobServiceClient).mockImplementation(() => serviceClient as any);

  return { containerClient, serviceClient };
}

// ============================================================
// Helper to build S3 mock chain
// ============================================================
function setupS3Mock() {
  const send = vi.fn().mockResolvedValue({
    Contents: [{ Key: "test.pdf", Size: 1000, LastModified: new Date() }],
    KeyCount: 1,
    IsTruncated: false,
  });

  vi.mocked(S3Client).mockImplementation(() => ({ send, destroy: vi.fn(), config: {} }) as any);

  return { send };
}

// ============================================================
// Helper to build SFTP mock chain
// ============================================================
function setupSftpMock() {
  const instance = {
    connect: vi.fn().mockResolvedValue(undefined),
    cwd: vi.fn().mockResolvedValue("/"),
    list: vi.fn().mockResolvedValue([
      { name: "test.pdf", type: "-", size: 1000, modifyTime: Date.now() },
    ]),
    get: vi.fn().mockResolvedValue(Buffer.from("test content")),
    stat: vi.fn().mockResolvedValue({
      size: 1000,
      modifyTime: Date.now(),
      isDirectory: false,
    }),
    end: vi.fn().mockResolvedValue(undefined),
  };

  vi.mocked(SFTPClient).mockImplementation(() => instance as any);

  return { instance };
}

// ==========================================================
// Azure Blob Connector
// ==========================================================
describe("AzureBlobConnector", () => {
  let connector: AzureBlobConnector;

  beforeEach(() => {
    setupAzureBlobMock();
    connector = new AzureBlobConnector({
      connectionString:
        "DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net",
      containerName: "contracts",
    });
  });

  it("testConnection should return success", async () => {
    const result = await connector.testConnection();
    expect(result).toHaveProperty("success", true);
  });

  it("listFiles should return files from container", async () => {
    const result = await connector.listFiles("/");
    expect(result).toHaveProperty("files");
    expect(result.files.length).toBeGreaterThanOrEqual(1);
    expect(result.files[0].name).toBe("test.pdf");
  });

  it("downloadFile should return content buffer", async () => {
    const result = await connector.downloadFile("test.pdf");
    expect(result).toHaveProperty("content");
    expect(Buffer.isBuffer(result.content)).toBe(true);
  });
});

// ==========================================================
// S3 Connector
// ==========================================================
describe("S3Connector", () => {
  let connector: S3Connector;

  beforeEach(() => {
    setupS3Mock();
    connector = new S3Connector({
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      bucket: "test-bucket",
      region: "us-east-1",
    });
  });

  it("testConnection should return success", async () => {
    const result = await connector.testConnection();
    expect(result).toHaveProperty("success", true);
  });

  it("listFiles should return objects from bucket", async () => {
    const result = await connector.listFiles("/");
    expect(result).toHaveProperty("files");
    expect(result.files.length).toBeGreaterThanOrEqual(1);
    expect(result.files[0].name).toBe("test.pdf");
  });
});

// ==========================================================
// SFTP Connector
// ==========================================================
describe("SFTPConnector", () => {
  let connector: SFTPConnector;

  beforeEach(() => {
    const { instance } = setupSftpMock();
    connector = new SFTPConnector({
      host: "sftp.example.com",
      port: 22,
      username: "testuser",
      password: "testpass",
    });
  });

  it("testConnection should return success", async () => {
    const result = await connector.testConnection();
    expect(result).toHaveProperty("success", true);
  });

  it("listFiles should return files from directory", async () => {
    const result = await connector.listFiles("/contracts");
    expect(result).toHaveProperty("files");
    expect(result.files.length).toBeGreaterThanOrEqual(1);
    expect(result.files[0].name).toBe("test.pdf");
  });

  it("listFiles should separate files and directories", async () => {
    // Override the list mock for this test
    const { instance } = setupSftpMock();
    instance.list.mockResolvedValue([
      { name: "test.pdf", type: "-", size: 1000, modifyTime: Date.now() },
      { name: "subdir", type: "d", size: 0, modifyTime: Date.now() },
    ]);

    connector = new SFTPConnector({
      host: "sftp.example.com",
      port: 22,
      username: "testuser",
      password: "testpass",
    });

    const result = await connector.listFiles("/");
    const nonDirFiles = result.files.filter((f) => !f.isFolder);
    expect(nonDirFiles).toHaveLength(1);
    if (result.folders) {
      expect(result.folders.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("downloadFile should return content buffer", async () => {
    const result = await connector.downloadFile("/contracts/test.pdf");
    expect(result).toHaveProperty("content");
    expect(Buffer.isBuffer(result.content)).toBe(true);
  });
});

// ==========================================================
// Connector Factory
// ==========================================================
describe("ConnectorFactory", () => {
  beforeEach(() => {
    setupAzureBlobMock();
    setupS3Mock();
    setupSftpMock();
  });

  it("should create AzureBlobConnector for AZURE_BLOB provider", () => {
    const connector = createConnector("AZURE_BLOB" as any, {
      connectionString:
        "DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net",
      containerName: "test",
    } as any);
    expect(connector).toBeInstanceOf(AzureBlobConnector);
  });

  it("should create S3Connector for AWS_S3 provider", () => {
    const connector = createConnector("AWS_S3" as any, {
      accessKeyId: "test",
      secretAccessKey: "test",
      bucket: "test",
      region: "us-east-1",
    } as any);
    expect(connector).toBeInstanceOf(S3Connector);
  });

  it("should create SFTPConnector for SFTP provider", () => {
    const connector = createConnector("SFTP" as any, {
      host: "sftp.example.com",
      username: "test",
      password: "test",
    } as any);
    expect(connector).toBeInstanceOf(SFTPConnector);
  });

  it("should throw error for unknown provider", () => {
    expect(() => createConnector("UNKNOWN" as any, {} as any)).toThrow();
  });
});

// ==========================================================
// Credential Encryption
// ==========================================================
describe("Credential Encryption", () => {
  it("should encrypt and decrypt credentials", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    try {
      const { encryptCredentials, decryptCredentials } = await import(
        "../connectors/encryption"
      );

      const originalCreds = {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      };

      const encrypted = encryptCredentials(originalCreds);
      expect(encrypted).toHaveProperty("encrypted");
      expect(encrypted).toHaveProperty("iv");
      expect(encrypted).toHaveProperty("authTag");
      expect(encrypted.encrypted).not.toBe(JSON.stringify(originalCreds));

      const decrypted = decryptCredentials<typeof originalCreds>(encrypted);
      expect(decrypted).toEqual(originalCreds);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});

// ==========================================================
// Batch / Utility Operations
// ==========================================================
describe("Batch Operations", () => {
  it("should chunk arrays correctly", () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const chunkSize = 3;

    const chunks: number[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }

    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toEqual([1, 2, 3]);
    expect(chunks[3]).toEqual([10]);
  });

  it("should sanitize filenames", () => {
    const sanitize = (filename: string) =>
      filename
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
        .replace(/\.{2,}/g, ".")
        .slice(0, 255);

    expect(sanitize("test<file>.pdf")).toBe("test_file_.pdf");
    expect(sanitize("file..name.pdf")).toBe("file.name.pdf");
    expect(sanitize("normal-file.pdf")).toBe("normal-file.pdf");
  });
});
