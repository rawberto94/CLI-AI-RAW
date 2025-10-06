/**
 * Database Connection Pool
 * Optimized connection management for high-performance queries
 */

interface PoolConfig {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

interface Connection {
  id: string;
  inUse: boolean;
  lastUsed: number;
  query: <T>(sql: string, params?: any[]) => Promise<T>;
}

export class ConnectionPool {
  private connections: Connection[] = [];
  private config: PoolConfig;
  private waitQueue: Array<(conn: Connection) => void> = [];

  constructor(config?: Partial<PoolConfig>) {
    this.config = {
      min: config?.min || 2,
      max: config?.max || 10,
      idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config?.connectionTimeoutMillis || 5000,
    };

    this.initialize();
  }

  private async initialize() {
    // Create minimum connections
    for (let i = 0; i < this.config.min; i++) {
      await this.createConnection();
    }

    // Start idle connection cleanup
    setInterval(() => this.cleanupIdleConnections(), 10000);
  }

  private async createConnection(): Promise<Connection> {
    const conn: Connection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      inUse: false,
      lastUsed: Date.now(),
      query: async <T>(_sql: string, _params?: any[]): Promise<T> => {
        // Simulate query execution
        await new Promise(resolve => setTimeout(resolve, 10));
        return {} as T;
      },
    };

    this.connections.push(conn);
    return conn;
  }

  async acquire(): Promise<Connection> {
    // Find available connection
    const available = this.connections.find(c => !c.inUse);
    if (available) {
      available.inUse = true;
      available.lastUsed = Date.now();
      return available;
    }

    // Create new connection if under max
    if (this.connections.length < this.config.max) {
      const conn = await this.createConnection();
      conn.inUse = true;
      return conn;
    }

    // Wait for connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.indexOf(resolve);
        if (index > -1) this.waitQueue.splice(index, 1);
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeoutMillis);

      this.waitQueue.push((conn) => {
        clearTimeout(timeout);
        resolve(conn);
      });
    });
  }

  release(conn: Connection): void {
    conn.inUse = false;
    conn.lastUsed = Date.now();

    // Serve waiting requests
    const waiter = this.waitQueue.shift();
    if (waiter) {
      conn.inUse = true;
      waiter(conn);
    }
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    const minConnections = this.config.min;

    // Keep only active and recently used connections
    this.connections = this.connections.filter((conn, index) => {
      if (conn.inUse) return true;
      if (index < minConnections) return true;
      return now - conn.lastUsed < this.config.idleTimeoutMillis;
    });
  }

  async query<T>(_sql: string, _params?: any[]): Promise<T> {
    const conn = await this.acquire();
    try {
      return await conn.query<T>(_sql, _params);
    } finally {
      this.release(conn);
    }
  }

  async transaction<T>(callback: (conn: Connection) => Promise<T>): Promise<T> {
    const conn = await this.acquire();
    try {
      // Begin transaction
      await conn.query('BEGIN');
      const result = await callback(conn);
      await conn.query('COMMIT');
      return result;
    } catch (error) {
      await conn.query('ROLLBACK');
      throw error;
    } finally {
      this.release(conn);
    }
  }

  getStats() {
    return {
      total: this.connections.length,
      active: this.connections.filter(c => c.inUse).length,
      idle: this.connections.filter(c => !c.inUse).length,
      waiting: this.waitQueue.length,
    };
  }

  async close(): Promise<void> {
    // Wait for all connections to be released
    while (this.connections.some(c => c.inUse)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.connections = [];
  }
}

export const dbPool = new ConnectionPool();
