const express = require('express');
const { prisma } = require('../utils/prisma');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

// GET /api/audit?workspaceId=xxx
router.get('/', authenticate, requirePermission('view:audit'), async (req, res, next) => {
  try {
    const { workspaceId, entityType, limit = 50, offset = 0 } = req.query;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const logs = await prisma.auditLog.findMany({
      where: { workspaceId, ...(entityType && { entityType }) },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    const total = await prisma.auditLog.count({ where: { workspaceId } });
    res.json({ logs, total });
  } catch (err) { next(err); }
});

module.exports = router;
