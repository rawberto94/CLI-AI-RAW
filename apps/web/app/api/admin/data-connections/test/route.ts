import { NextRequest } from 'next/server';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from '@/lib/api-middleware';

/**
 * POST /api/admin/data-connections/test
 * Test a data connection before saving it.
 * Attempts to connect using the provided credentials and runs a simple query.
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  try {
    const body = await request.json();
    const { type, host, port, database, username, password, ssl, connectionString, contractTableName } = body;

    if (!type) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Connection type is required', 400);
    }

    const startTime = Date.now();

    switch (type) {
      case 'postgresql': {
        const { default: pg } = await import('pg');
        const connConfig = connectionString
          ? { connectionString }
          : {
              host: host || 'localhost',
              port: parseInt(port || '5432', 10),
              database: database || 'postgres',
              user: username,
              password: password,
              ssl: ssl === 'true' ? { rejectUnauthorized: false } : false,
              connectionTimeoutMillis: 10000,
            };
        const client = new pg.Client(connConfig);
        try {
          await client.connect();
          const versionResult = await client.query('SELECT version()');
          const version = versionResult.rows[0]?.version || 'unknown';

          // Check if the contract table exists
          let tableInfo: { tableName: string; exists: boolean; columns: { name: string; type: string }[] } | null = null;
          if (contractTableName) {
            const tableResult = await client.query(
              `SELECT column_name, data_type FROM information_schema.columns
               WHERE table_name = $1 ORDER BY ordinal_position LIMIT 20`,
              [contractTableName]
            );
            tableInfo = {
              tableName: contractTableName,
              exists: tableResult.rows.length > 0,
              columns: tableResult.rows.map((r: { column_name: string; data_type: string }) => ({
                name: r.column_name,
                type: r.data_type,
              })),
            };
          }

          await client.end();
          return createSuccessResponse(ctx, {
            success: true,
            message: `Connected successfully to PostgreSQL`,
            version: version.split(' ').slice(0, 2).join(' '),
            latencyMs: Date.now() - startTime,
            tableInfo,
          });
        } catch (err) {
          try { await client.end(); } catch { /* ignore */ }
          throw err;
        }
      }

      case 'mysql': {
        const mysql = await import('mysql2/promise');
        const connConfig = connectionString
          ? { uri: connectionString, connectTimeout: 10000 }
          : {
              host: host || 'localhost',
              port: parseInt(port || '3306', 10),
              database: database || undefined,
              user: username,
              password: password,
              ssl: ssl === 'true' ? { rejectUnauthorized: false } : undefined,
              connectTimeout: 10000,
            };
        const conn = await mysql.createConnection(connConfig as any);
        try {
          const [rows] = await conn.query('SELECT VERSION() as version') as [Array<{ version: string }>, unknown];
          const version = rows[0]?.version || 'unknown';

          let tableInfo: { tableName: string; exists: boolean; columns: { name: string; type: string }[] } | null = null;
          if (contractTableName && database) {
            const [cols] = await conn.query(
              `SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type
               FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
               ORDER BY ORDINAL_POSITION LIMIT 20`,
              [database, contractTableName]
            ) as [Array<{ column_name: string; data_type: string }>, unknown];
            tableInfo = {
              tableName: contractTableName,
              exists: cols.length > 0,
              columns: cols.map((r) => ({ name: r.column_name, type: r.data_type })),
            };
          }

          await conn.end();
          return createSuccessResponse(ctx, {
            success: true,
            message: 'Connected successfully to MySQL',
            version: `MySQL ${version}`,
            latencyMs: Date.now() - startTime,
            tableInfo,
          });
        } catch (err) {
          try { await conn.end(); } catch { /* ignore */ }
          throw err;
        }
      }

      case 'sqlserver': {
        const sql = await import('mssql');
        const config: Record<string, unknown> = connectionString
          ? { connectionString }
          : {
              server: host || 'localhost',
              port: parseInt(port || '1433', 10),
              database: database || 'master',
              user: username,
              password: password,
              options: {
                encrypt: ssl === 'true',
                trustServerCertificate: true,
                connectTimeout: 10000,
              },
            };
        const pool = await (sql.default.connect as any)(config);
        try {
          const result = await (pool as any).query`SELECT @@VERSION as version`;
          const version = result.recordset[0]?.version?.split('\n')[0] || 'unknown';

          let tableInfo: { tableName: string; exists: boolean; columns: { name: string; type: string }[] } | null = null;
          if (contractTableName) {
            const colResult = await (pool as any).query`
              SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type
              FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_NAME = ${contractTableName}
              ORDER BY ORDINAL_POSITION`;
            tableInfo = {
              tableName: contractTableName,
              exists: colResult.recordset.length > 0,
              columns: colResult.recordset.map((r: { column_name: string; data_type: string }) => ({
                name: r.column_name,
                type: r.data_type,
              })),
            };
          }

          await pool.close();
          return createSuccessResponse(ctx, {
            success: true,
            message: 'Connected successfully to SQL Server',
            version,
            latencyMs: Date.now() - startTime,
            tableInfo,
          });
        } catch (err) {
          try { await pool.close(); } catch { /* ignore */ }
          throw err;
        }
      }

      case 's3':
      case 'azure_blob':
      case 'sharepoint':
        // Storage-based connections — redirect to Contract Sources
        return createSuccessResponse(ctx, {
          success: true,
          message: `${type} connection type is supported. Use Settings → Contract Sources for file-based integrations.`,
          latencyMs: Date.now() - startTime,
        });

      default:
        return createErrorResponse(
          ctx,
          'VALIDATION_ERROR',
          `Unsupported connection type: ${type}. Supported: postgresql, mysql, sqlserver`,
          400
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Return connection-specific error messages
    if (message.includes('ECONNREFUSED')) {
      return createSuccessResponse(ctx, {
        success: false,
        message: `Connection refused. Check that the database is running and the host/port are correct.`,
      });
    }
    if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
      return createSuccessResponse(ctx, {
        success: false,
        message: `Connection timed out. The database may be unreachable or behind a firewall.`,
      });
    }
    if (message.includes('authentication') || message.includes('password') || message.includes('login')) {
      return createSuccessResponse(ctx, {
        success: false,
        message: `Authentication failed. Check your username and password.`,
      });
    }
    return createSuccessResponse(ctx, {
      success: false,
      message: `Connection failed: ${message}`,
    });
  }
})
