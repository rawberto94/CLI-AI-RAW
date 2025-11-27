/**
 * WebSocket Server for Real-Time Collaboration
 * 
 * This server handles:
 * - User presence tracking
 * - Real-time document editing
 * - Cursor synchronization
 * - Section locking
 * - Notifications
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

// Optional Redis import - only used if REDIS_URL is provided
let Redis: typeof import('ioredis').default | null = null;
try {
  Redis = require('ioredis').default;
} catch {
  // Redis not available
}

// Types
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
}

interface CursorPosition {
  line: number;
  column: number;
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

interface DocumentChange {
  type: 'insert' | 'delete' | 'replace';
  position: { line: number; column: number };
  content?: string;
  length?: number;
  timestamp: number;
}

interface RoomState {
  users: Map<string, User>;
  lockedSections: Map<string, { userId: string; userName: string; lockedAt: number }>;
  documentVersion: number;
}

// Color palette for user cursors
const CURSOR_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

export class WebSocketServer {
  private io: SocketIOServer;
  private redis: InstanceType<typeof import('ioredis').default> | null = null;
  private rooms: Map<string, RoomState> = new Map();
  private userColors: Map<string, string> = new Map();
  private colorIndex = 0;

  constructor(httpServer: HttpServer, options?: { redisUrl?: string }) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Initialize Redis if URL provided and Redis is available
    if (options?.redisUrl && Redis) {
      this.redis = new Redis(options.redisUrl);
      this.redis.on('error', (err: Error) => {
        console.error('Redis connection error:', err);
      });
    }

    this.setupEventHandlers();
    console.log('WebSocket server initialized');
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      // User authentication
      socket.on('authenticate', async (data: { user: User }) => {
        const { user } = data;
        
        // Assign a consistent color to this user
        if (!this.userColors.has(user.id)) {
          this.userColors.set(user.id, CURSOR_COLORS[this.colorIndex % CURSOR_COLORS.length] ?? '#FF0000');
          this.colorIndex++;
        }
        user.color = this.userColors.get(user.id) ?? '#FF0000';
        
        // Store user data on socket
        socket.data.user = user;
        socket.emit('authenticated', { user });
      });

      // Join a room (document)
      socket.on('join-room', async (data: { roomId: string }) => {
        const { roomId } = data;
        const user = socket.data.user as User;

        if (!user) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        // Leave any existing rooms
        const currentRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        for (const room of currentRooms) {
          await this.leaveRoom(socket, room);
        }

        // Join the new room
        socket.join(roomId);
        
        // Initialize room state if needed
        if (!this.rooms.has(roomId)) {
          this.rooms.set(roomId, {
            users: new Map(),
            lockedSections: new Map(),
            documentVersion: 0,
          });
        }

        const roomState = this.rooms.get(roomId)!;
        roomState.users.set(socket.id, user);

        // Notify room members
        socket.to(roomId).emit('user-joined', { user, roomId });
        
        // Send current room state to the new user
        socket.emit('room-state', {
          roomId,
          users: Array.from(roomState.users.values()),
          lockedSections: Array.from(roomState.lockedSections.entries()).map(([sectionId, lock]) => ({
            sectionId,
            ...lock,
          })),
          documentVersion: roomState.documentVersion,
        });

        console.log(`User ${user.name} joined room ${roomId}`);
      });

      // Leave a room
      socket.on('leave-room', async (data: { roomId: string }) => {
        await this.leaveRoom(socket, data.roomId);
      });

      // Cursor movement
      socket.on('cursor-move', (data: { roomId: string; position: CursorPosition }) => {
        const user = socket.data.user as User;
        if (!user) return;

        socket.to(data.roomId).emit('cursor-update', {
          userId: user.id,
          userName: user.name,
          color: user.color,
          position: data.position,
        });
      });

      // Document changes
      socket.on('document-change', (data: { roomId: string; change: DocumentChange }) => {
        const user = socket.data.user as User;
        if (!user) return;

        const roomState = this.rooms.get(data.roomId);
        if (roomState) {
          roomState.documentVersion++;
        }

        socket.to(data.roomId).emit('document-update', {
          userId: user.id,
          userName: user.name,
          change: data.change,
          version: roomState?.documentVersion || 0,
        });
      });

      // Section locking
      socket.on('lock-section', (data: { roomId: string; sectionId: string }) => {
        const user = socket.data.user as User;
        if (!user) return;

        const roomState = this.rooms.get(data.roomId);
        if (!roomState) return;

        // Check if section is already locked by another user
        const existingLock = roomState.lockedSections.get(data.sectionId);
        if (existingLock && existingLock.userId !== user.id) {
          socket.emit('lock-rejected', {
            sectionId: data.sectionId,
            lockedBy: existingLock.userName,
          });
          return;
        }

        // Lock the section
        roomState.lockedSections.set(data.sectionId, {
          userId: user.id,
          userName: user.name,
          lockedAt: Date.now(),
        });

        this.io.to(data.roomId).emit('section-locked', {
          sectionId: data.sectionId,
          userId: user.id,
          userName: user.name,
        });
      });

      // Section unlocking
      socket.on('unlock-section', (data: { roomId: string; sectionId: string }) => {
        const user = socket.data.user as User;
        if (!user) return;

        const roomState = this.rooms.get(data.roomId);
        if (!roomState) return;

        const lock = roomState.lockedSections.get(data.sectionId);
        if (lock && lock.userId === user.id) {
          roomState.lockedSections.delete(data.sectionId);
          
          this.io.to(data.roomId).emit('section-unlocked', {
            sectionId: data.sectionId,
            userId: user.id,
          });
        }
      });

      // Chat/Comments
      socket.on('send-comment', (data: { roomId: string; comment: { text: string; sectionId?: string } }) => {
        const user = socket.data.user as User;
        if (!user) return;

        this.io.to(data.roomId).emit('new-comment', {
          id: `comment-${Date.now()}`,
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar,
          text: data.comment.text,
          sectionId: data.comment.sectionId,
          timestamp: new Date().toISOString(),
        });
      });

      // Typing indicator
      socket.on('typing-start', (data: { roomId: string; sectionId?: string }) => {
        const user = socket.data.user as User;
        if (!user) return;

        socket.to(data.roomId).emit('user-typing', {
          userId: user.id,
          userName: user.name,
          sectionId: data.sectionId,
        });
      });

      socket.on('typing-stop', (data: { roomId: string }) => {
        const user = socket.data.user as User;
        if (!user) return;

        socket.to(data.roomId).emit('user-stopped-typing', {
          userId: user.id,
        });
      });

      // Notifications
      socket.on('send-notification', (data: { 
        roomId: string; 
        notification: { 
          type: string; 
          message: string; 
          targetUserId?: string;
        } 
      }) => {
        const user = socket.data.user as User;
        if (!user) return;

        const notification = {
          id: `notif-${Date.now()}`,
          type: data.notification.type,
          message: data.notification.message,
          fromUser: user.name,
          timestamp: new Date().toISOString(),
        };

        if (data.notification.targetUserId) {
          // Send to specific user
          const roomState = this.rooms.get(data.roomId);
          if (roomState) {
            for (const [socketId, roomUser] of roomState.users) {
              if (roomUser.id === data.notification.targetUserId) {
                this.io.to(socketId).emit('notification', notification);
                break;
              }
            }
          }
        } else {
          // Broadcast to room
          this.io.to(data.roomId).emit('notification', notification);
        }
      });

      // Disconnect handling
      socket.on('disconnect', async () => {
        const user = socket.data.user as User;
        console.log(`Client disconnected: ${socket.id}${user ? ` (${user.name})` : ''}`);

        // Clean up all rooms
        for (const [roomId, roomState] of this.rooms) {
          if (roomState.users.has(socket.id)) {
            await this.leaveRoom(socket, roomId);
          }
        }
      });
    });
  }

  private async leaveRoom(socket: Socket, roomId: string): Promise<void> {
    const user = socket.data.user as User;
    const roomState = this.rooms.get(roomId);

    if (roomState && user) {
      roomState.users.delete(socket.id);

      // Release any locks held by this user
      for (const [sectionId, lock] of roomState.lockedSections) {
        if (lock.userId === user.id) {
          roomState.lockedSections.delete(sectionId);
          this.io.to(roomId).emit('section-unlocked', {
            sectionId,
            userId: user.id,
          });
        }
      }

      // Notify other users
      socket.to(roomId).emit('user-left', { userId: user.id, roomId });

      // Clean up empty rooms
      if (roomState.users.size === 0) {
        this.rooms.delete(roomId);
      }

      console.log(`User ${user.name} left room ${roomId}`);
    }

    socket.leave(roomId);
  }

  // Send a notification to all users in a room
  public broadcastToRoom(roomId: string, event: string, data: unknown): void {
    this.io.to(roomId).emit(event, data);
  }

  // Send a notification to a specific user
  public sendToUser(userId: string, event: string, data: unknown): void {
    for (const [roomId, roomState] of this.rooms) {
      for (const [socketId, user] of roomState.users) {
        if (user.id === userId) {
          this.io.to(socketId).emit(event, data);
          return;
        }
      }
    }
  }

  // Get all users in a room
  public getRoomUsers(roomId: string): User[] {
    const roomState = this.rooms.get(roomId);
    return roomState ? Array.from(roomState.users.values()) : [];
  }

  // Get room statistics
  public getStats(): { rooms: number; users: number; connections: number } {
    let totalUsers = 0;
    for (const roomState of this.rooms.values()) {
      totalUsers += roomState.users.size;
    }

    return {
      rooms: this.rooms.size,
      users: totalUsers,
      connections: this.io.sockets.sockets.size,
    };
  }

  // Graceful shutdown
  public async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    await this.io.close();
    console.log('WebSocket server closed');
  }
}

// Factory function for creating the server
export function createWebSocketServer(
  httpServer: HttpServer,
  options?: { redisUrl?: string }
): WebSocketServer {
  return new WebSocketServer(httpServer, options);
}

export default WebSocketServer;
