// Type declarations for optional dependencies
// These modules are conditionally imported and may not be installed

declare module 'pdf-to-img' {
  export interface PdfToImgOptions {
    scale?: number;
    page?: number;
  }
  
  export function pdf(input: Buffer | string, options?: PdfToImgOptions): AsyncIterable<Buffer>;
  export default function convert(input: Buffer | string, options?: PdfToImgOptions): AsyncIterable<Buffer>;
}

declare module 'mysql2/promise' {
  export interface Connection {
    query(sql: string, values?: any[]): Promise<[any[], any]>;
    execute(sql: string, values?: any[]): Promise<[any[], any]>;
    end(): Promise<void>;
  }
  
  export interface ConnectionConfig {
    host: string;
    port?: number;
    user: string;
    password: string;
    database: string;
    ssl?: boolean | object;
  }
  
  export function createConnection(config: ConnectionConfig): Promise<Connection>;
}

declare module 'mssql' {
  export interface ConnectionConfig {
    server: string;
    port?: number;
    user: string;
    password: string;
    database: string;
    options?: {
      encrypt?: boolean;
      trustServerCertificate?: boolean;
    };
  }
  
  export interface RecordSet<T = any> {
    recordset: T[];
  }
  
  export interface Request {
    query<T = any>(sql: string): Promise<RecordSet<T>>;
  }
  
  export interface ConnectionPool {
    request(): Request;
    close(): Promise<void>;
  }
  
  export function connect(config: ConnectionConfig): Promise<ConnectionPool>;
}
