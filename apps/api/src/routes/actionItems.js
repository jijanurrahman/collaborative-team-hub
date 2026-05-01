const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../utils/prisma');
const { authenticate, requirePermission } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { createNotification } = require('../utils/notifications');

const router = express.Router();

// GET /api/action-items?workspaceId=xxx&status=xxx&assigneeId=xxx
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { workspaceId, status, assigneeId, goalId, priority } = req.query;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const items = await prisma.actionItem.findMany({
      where: {
        workspaceId,
        ...(status && { status }),
        ...(assigneeId && { assigneeId }),
        ...(goalId && { goalId }),
        ...(priority && { priority }),
      },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, avatarUrl: true } },
        goal: { select: { id: true, title: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ items });
  } catch (err) { next(err); }
});

// POST /api/action-items
router.post('/', authenticate, requirePermission('create:action'), [
  body('title').trim().isLength({ min: 2, max: 200 }),
  body('workspaceId').isUUID(),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  body('status').optional().isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']),
  body('dueDate').optional().isISO8601(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { title, description, workspaceId, goalId, assigneeId, priority, status, dueDate } = req.body;

    const item = await prisma.actionItem.create({
      data: {
        title, description, workspaceId,
        goalId: goalId || null,
        assigneeId: assigneeId || null,
        creatorId: req.user.id,
        priority: priority || 'MEDIUM',
        status: status || 'TODO',
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, avatarUrl: true } },
        goal: { select: { id: true, title: true } },
      },
    });

    if (assigneeId && assigneeId !== req.user.id) {
      await createNotification({
        userId: assigneeId, type: 'ACTION_ITEM_ASSIGNED',
        title: 'Action item assigned to you',
        message: `${req.user.name} assigned "${title}" to you`,
        link: `/workspaces/${workspaceId}/action-items/${item.id}`,
      });
    }

    await createAuditLog({ workspaceId, userId: req.user.id, action: 'CREATE', entityType: 'ACTION_ITEM', entityId: item.id, metadata: { title } });

    const io = req.app.get('io');
    io.to(`workspace:${workspaceId}`).emit('action_item:created', item);

    res.status(201).json({ item });
  } catch (err) { next(err); }
});

// GET /api/action-items/:itemId
router.get('/:itemId', authenticate, async (req, res, next) => {
  try {
    const item = await prisma.actionItem.findUnique({
      where: { id: req.params.itemId },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, avatarUrl: true } },
        goal: { select: { id: true, title: true } },
        comments: {
          where: { parentId: null },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            reactions: { include: { user: { select: { id: true, name: true } } } },
            replies: { include: { author: { select: { id: true, name: true, avatarUrl: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!item) return res.status(404).json({ error: 'Action item not found' });

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: item.workspaceId, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Not a member' });

    res.json({ item });
  } catch (err) { next(err); }
});

// PATCH /api/action-items/:itemId
router.patch('/:itemId', authenticate, requirePermission('edit:action'), [
  body('status').optional().isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const existing = await prisma.actionItem.findUnique({ where: { id: req.params.itemId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { title, description, status, priority, assigneeId, dueDate, goalId } = req.body;

    const item = await prisma.actionItem.update({
      where: { id: req.params.itemId },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(goalId !== undefined && { goalId: goalId || null }),
      },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, avatarUrl: true } },
        goal: { select: { id: true, title: true } },
      },
    });

    await createAuditLog({ workspaceId: item.workspaceId, userId: req.user.id, action: 'UPDATE', entityType: 'ACTION_ITEM', entityId: item.id, metadata: { status } });

    const io = req.app.get('io');
    io.to(`workspace:${item.workspaceId}`).emit('action_item:updated', item);

    res.json({ item });
  } catch (err) { next(err); }
});

// DELETE /api/action-items/:itemId
router.delete('/:itemId', authenticate, requirePermission('delete:action'), async (req, res, next) => {
  try {
    const item = await prisma.actionItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: 'Not found' });

    await prisma.actionItem.delete({ where: { id: req.params.itemId } });
    const io = req.app.get('io');
    io.to(`workspace:${item.workspaceId}`).emit('action_item:deleted', { id: item.id });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

// POST /api/action-items/:itemId/comments
router.post('/:itemId/comments', authenticate, [
  body('content').trim().isLength({ min: 1, max: 2000 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const item = await prisma.actionItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: 'Not found' });

    const comment = await prisma.comment.create({
      data: { content: req.body.content, authorId: req.user.id, actionItemId: req.params.itemId },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const io = req.app.get('io');
    io.to(`workspace:${item.workspaceId}`).emit('comment:created', { actionItemId: item.id, comment });
    res.status(201).json({ comment });
  } catch (err) { next(err); }
});

module.exports = router;
