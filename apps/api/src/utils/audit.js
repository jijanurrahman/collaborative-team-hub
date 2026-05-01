const { prisma } = require('./prisma');
const { logger } = require('./logger');

async function createAuditLog({ workspaceId, userId, action, entityType, entityId, metadata = {} }) {
  try {
    await prisma.auditLog.create({
      data: { workspaceId, userId, action, entityType, entityId, metadata },
    });
  } catch (err) {
    logger.error('Failed to create audit log:', err);
  }
}

module.exports = { createAuditLog };
