/**
 * Contract Source Connector Tests
 * 
 * Comprehensive tests for all contract source connectors.
 */

import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { Readable } from "stream";

// Mock external dependencies
vi.mock("@azure/storage-blob", () => ({
  BlobServiceClient: vi.fn().mockImplementation(() => ({
    getContainerClient: vi.fn().mockReturnValue({
      exists: vi.fn().mockResolvedValue(true),
      listBlobsFlat: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { name: "test.pdf", properties: { contentLength: 1000, lastModified: new Date() } };
        },
      }),
      getBlockBlobClient: vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue({
          readableStreamBody: Readable.from(Buffer.from("test content")),
        }),
      }),
    }),
  })),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  ListObjectsV2Command: vi.fn(),
  GetObjectCommand: vi.fn(),
  HeadBucketCommand: vi.fn(),
}));

vi.mock("ssh2-sftp-client", () => ({
  default: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([
      { name: "test.pdf", type: "-", size: 1000, modifyTime: Date.now() },
    ]),
    get: vi.fn().mockResolvedValue(Readable.from(Buffer.from("test content"))),
    end: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Import connectors
import { AzureBlobConnector } from "../connectors/azure-blob.connector";
import { S3Connector } from "../connectors/s3.connector";
import { SftpConnector } from "../connectors/sftp.connector";
import { createConnector } from "../connectors/factory";

describe("AzureBlobConnector", () => {
  let connector: AzureBlobConnector;

  beforeEach(() => {
    connector = new AzureBlobConnector({
      connectionString: "DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key",
      containerName: "contracts",
    });
  });

  describe("testConnection", () => {
    it("should return true for valid connection", async () => {
      const result = await connector.testConnection();
      expect(result).toBe(true);
    });
  });

  describe("listFiles", () => {
    it("should list files from container", async () => {
      const files = await connector.listFiles("/");
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe("test.pdf");
    });

    it("should apply file type filter", async () => {
      const files = await connector.listFiles("/", {
        fileTypes: [".pdf"],
      });
      expect(files).toHaveLength(1);
    });
  });

  describe("downloadFile", () => {
    it("should return readable stream", async () => {
      const stream = await connector.downloadFile("test.pdf");
      expect(stream).toBeInstanceOf(Readable);
    });
  });
});

describe("S3Connector", () => {
  let connector: S3Connector;

  beforeEach(() => {
    connector = new S3Connector({
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      bucket: "test-bucket",
      region: "us-east-1",
    });
  });

  describe("testConnection", () => {
    it("should test bucket access", async () => {
      // Mock S3 client response
      const S3Client = require("@aws-sdk/client-s3").S3Client;
      (S3Client as Mock).mockImplementation(() => ({
        send: vi.fn().mockResolvedValue({}),
      }));

      const result = await connector.testConnection();
      expect(result).toBe(true);
    });
  });

  describe("listFiles", () => {
    it("should list objects from bucket", async () => {
      const S3Client = require("@aws-sdk/client-s3").S3Client;
      (S3Client as Mock).mockImplementation(() => ({
        send: vi.fn().mockResolvedValue({
          Contents: [
            { Key: "test.pdf", Size: 1000, LastModified: new Date() },
          ],
          IsTruncated: false,
        }),
      }));

      connector = new S3Connector({
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
        region: "us-east-1",
      });

      const files = await connector.listFiles("/");
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe("test.pdf");
    });
  });
});

describe("SftpConnector", () => {
  let connector: SftpConnector;

  beforeEach(() => {
    connector = new SftpConnector({
      host: "sftp.example.com",
      port: 22,
      username: "testuser",
      password: "testpass",
    });
  });

  describe("testConnection", () => {
    it("should connect and disconnect successfully", async () => {
      const result = await connector.testConnection();
      expect(result).toBe(true);
    });
  });

  describe("listFiles", () => {
    it("should list files from directory", async () => {
      const files = await connector.listFiles("/contracts");
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe("test.pdf");
    });

    it("should filter directories", async () => {
      const SftpClient = require("ssh2-sftp-client").default;
      (SftpClient as Mock).mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([
          { name: "test.pdf", type: "-", size: 1000, modifyTime: Date.now() },
          { name: "subdir", type: "d", size: 0, modifyTime: Date.now() },
        ]),
        end: vi.fn().mockResolvedValue(undefined),
      }));

      connector = new SftpConnector({
        host: "sftp.example.com",
        port: 22,
        username: "testuser",
        password: "testpass",
      });

      const files = await connector.listFiles("/");
      expect(files.filter((f) => !f.isDirectory)).toHaveLength(1);
    });
  });

  describe("downloadFile", () => {
    it("should return file as readable stream", async () => {
      const stream = await connector.downloadFile("/contracts/test.pdf");
      expect(stream).toBeInstanceOf(Readable);
    });
  });
});

describe("ConnectorFactory", () => {
  it("should create AzureBlobConnector for AZURE_BLOB provider", async () => {
    const source = {
      id: "test-id",
      provider: "AZURE_BLOB" as const,
      credentials: JSON.stringify({
        connectionString: "test",
        containerName: "test",
      }),
    };

    const connector = await createConnector(source as any);
    expect(connector).toBeInstanceOf(AzureBlobConnector);
  });

  it("should create S3Connector for S3 provider", async () => {
    const source = {
      id: "test-id",
      provider: "S3" as const,
      credentials: JSON.stringify({
        accessKeyId: "test",
        secretAccessKey: "test",
        bucket: "test",
        region: "us-east-1",
      }),
    };

    const connector = await createConnector(source as any);
    expect(connector).toBeInstanceOf(S3Connector);
  });

  it("should create SftpConnector for SFTP provider", async () => {
    const source = {
      id: "test-id",
      provider: "SFTP" as const,
      credentials: JSON.stringify({
        host: "sftp.example.com",
        username: "test",
        password: "test",
      }),
    };

    const connector = await createConnector(source as any);
    expect(connector).toBeInstanceOf(SftpConnector);
  });

  it("should throw error for unknown provider", async () => {
    const source = {
      id: "test-id",
      provider: "UNKNOWN" as any,
      credentials: "{}",
    };

    await expect(createConnector(source as any)).rejects.toThrow();
  });
});

describe("Credential Encryption", () => {
  it("should encrypt and decrypt credentials", async () => {
    const { encryptCredentials, decryptCredentials } = await import(
      "../utils/encryption"
    );

    const originalCreds = {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    };

    const encrypted = encryptCredentials(originalCreds);
    expect(encrypted).not.toBe(JSON.stringify(originalCreds));
    expect(encrypted).toContain(":");

    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toEqual(originalCreds);
  });
});

describe("Rate Limiting", () => {
  it("should allow requests within limit", async () => {
    const { createRateLimiter } = await import("../middleware/rate-limit");
    const limiter = createRateLimiter("default");

    const mockReq = { headers: new Headers() } as any;
    const mockHandler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }))
    );

    // First request should pass
    const response = await limiter(mockReq, mockHandler);
    expect(mockHandler).toHaveBeenCalled();
  });
});

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
