const { Server } = require('socket.io');
const { verifyAccessToken } = require('./utils/jwt');
const { prisma } = require('./utils/prisma');
const { logger } = require('./utils/logger');

const onlineUsers = new Map(); // userId -> Set of socketIds

function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
  });

  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication error'));

      const decoded = verifyAccessToken(token);
      socket.userId = decoded.userId;
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    logger.info(`Socket connected: ${userId}`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Join personal room for direct notifications
    socket.join(`user:${userId}`);

    // Update user online status
    await prisma.user.update({
      where: { id: userId },
      data: { isOnline: true, lastSeen: new Date() },
    }).catch(() => {});

    // Join workspace rooms
    socket.on('join:workspace', async (workspaceId) => {
      try {
        const member = await prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId } },
        });
        if (member) {
          socket.join(`workspace:${workspaceId}`);
          // Broadcast online members list to the whole workspace
          const onlineMemberIds = [];
          const members = await prisma.workspaceMember.findMany({
            where: { workspaceId },
            select: { userId: true },
          });
          members.forEach(m => {
            if (onlineUsers.has(m.userId)) {
              onlineMemberIds.push(m.userId);
            }
          });
          io.to(`workspace:${workspaceId}`).emit('workspace:online_members', onlineMemberIds);
          logger.info(`User ${userId} joined workspace ${workspaceId}`);
        }
      } catch (err) {
        logger.error('join:workspace error', err);
      }
    });

    socket.on('leave:workspace', (workspaceId) => {
      socket.leave(`workspace:${workspaceId}`);
    });

    // Collaborative editing - goal description
    socket.on('goal:edit', ({ workspaceId, goalId, content, cursor }) => {
      socket.to(`workspace:${workspaceId}`).emit('goal:edit', {
        goalId,
        content,
        cursor,
        userId,
        socketId: socket.id,
      });
    });

    socket.on('goal:cursor', ({ workspaceId, goalId, cursor }) => {
      socket.to(`workspace:${workspaceId}`).emit('goal:cursor', {
        goalId,
        cursor,
        userId,
        socketId: socket.id,
      });
    });

    // Typing indicators
    socket.on('typing:start', ({ workspaceId, context }) => {
      socket.to(`workspace:${workspaceId}`).emit('typing:start', { userId, context });
    });

    socket.on('typing:stop', ({ workspaceId, context }) => {
      socket.to(`workspace:${workspaceId}`).emit('typing:stop', { userId, context });
    });

    socket.on('disconnect', async () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          await prisma.user.update({
            where: { id: userId },
            data: { isOnline: false, lastSeen: new Date() },
          });
          // Broadcast offline status to all workspaces
          io.emit('user:offline', userId);
        }
      }
      logger.info(`Socket disconnected: ${userId}`);
    });
  });

  return io;
}

function getIO(app) {
  return app.get('io');
}

module.exports = { initializeSocket, getIO, onlineUsers };
