const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../utils/prisma');
const { authenticate, requirePermission } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { createNotification } = require('../utils/notifications');
const { processMentions } = require('../utils/mentions');

const router = express.Router();

// GET /api/goals?workspaceId=xxx
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { workspaceId, status, ownerId } = req.query;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const goals = await prisma.goal.findMany({
      where: {
        workspaceId,
        ...(status && { status }),
        ...(ownerId && { ownerId }),
      },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        milestones: true,
        _count: { select: { actionItems: true, comments: true, progressUpdates: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ goals });
  } catch (err) { next(err); }
});

// POST /api/goals
router.post('/', authenticate, requirePermission('create:goal'), [
  body('title').trim().isLength({ min: 2, max: 200 }),
  body('description').optional().trim(),
  body('workspaceId').isUUID(),
  body('dueDate').optional().isISO8601(),
  body('status').optional().isIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { title, description, workspaceId, dueDate, status } = req.body;
    const goal = await prisma.goal.create({
      data: {
        title, description, workspaceId,
        ownerId: req.body.ownerId || req.user.id,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'NOT_STARTED',
      },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        milestones: true,
        _count: { select: { actionItems: true, comments: true } },
      },
    });

    await createAuditLog({ workspaceId, userId: req.user.id, action: 'CREATE', entityType: 'GOAL', entityId: goal.id, metadata: { title } });

    const io = req.app.get('io');
    io.to(`workspace:${workspaceId}`).emit('goal:created', goal);

    res.status(201).json({ goal });
  } catch (err) { next(err); }
});

// GET /api/goals/:goalId
router.get('/:goalId', authenticate, async (req, res, next) => {
  try {
    const goal = await prisma.goal.findUnique({
      where: { id: req.params.goalId },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        milestones: { orderBy: { createdAt: 'asc' } },
        progressUpdates: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        comments: {
          where: { parentId: null },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            reactions: { include: { user: { select: { id: true, name: true } } } },
            replies: {
              include: { author: { select: { id: true, name: true, avatarUrl: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { actionItems: true } },
      },
    });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: goal.workspaceId, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Not a member' });

    res.json({ goal });
  } catch (err) { next(err); }
});

// PATCH /api/goals/:goalId
router.patch('/:goalId', authenticate, requirePermission('edit:goal'), [
  body('title').optional().trim().isLength({ min: 2, max: 200 }),
  body('description').optional().trim(),
  body('status').optional().isIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED']),
  body('dueDate').optional().isISO8601(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { title, description, status, dueDate, ownerId } = req.body;
    const existing = await prisma.goal.findUnique({ where: { id: req.params.goalId } });
    if (!existing) return res.status(404).json({ error: 'Goal not found' });

    const goal = await prisma.goal.update({
      where: { id: req.params.goalId },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(ownerId && { ownerId }),
      },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        milestones: true,
      },
    });

    await createAuditLog({ workspaceId: goal.workspaceId, userId: req.user.id, action: 'UPDATE', entityType: 'GOAL', entityId: goal.id, metadata: { status } });

    const io = req.app.get('io');
    io.to(`workspace:${goal.workspaceId}`).emit('goal:updated', goal);

    res.json({ goal });
  } catch (err) { next(err); }
});

// DELETE /api/goals/:goalId
router.delete('/:goalId', authenticate, requirePermission('delete:goal'), async (req, res, next) => {
  try {
    const goal = await prisma.goal.findUnique({ where: { id: req.params.goalId } });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    await prisma.goal.delete({ where: { id: req.params.goalId } });
    await createAuditLog({ workspaceId: goal.workspaceId, userId: req.user.id, action: 'DELETE', entityType: 'GOAL', entityId: goal.id, metadata: { title: goal.title } });

    const io = req.app.get('io');
    io.to(`workspace:${goal.workspaceId}`).emit('goal:deleted', { id: goal.id });
    res.json({ message: 'Goal deleted' });
  } catch (err) { next(err); }
});

// POST /api/goals/:goalId/milestones
router.post('/:goalId/milestones', authenticate, [
  body('title').trim().isLength({ min: 2, max: 200 }),
  body('progress').optional().isInt({ min: 0, max: 100 }),
  body('dueDate').optional().isISO8601(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { title, progress = 0, dueDate, status } = req.body;
    const goal = await prisma.goal.findUnique({ where: { id: req.params.goalId } });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const milestone = await prisma.milestone.create({
      data: { title, goalId: req.params.goalId, progress, status: status || 'NOT_STARTED', dueDate: dueDate ? new Date(dueDate) : null },
    });

    const io = req.app.get('io');
    io.to(`workspace:${goal.workspaceId}`).emit('milestone:created', { goalId: goal.id, milestone });
    res.status(201).json({ milestone });
  } catch (err) { next(err); }
});

// PATCH /api/goals/:goalId/milestones/:milestoneId
router.patch('/:goalId/milestones/:milestoneId', authenticate, async (req, res, next) => {
  try {
    const { title, progress, status, dueDate } = req.body;
    const goal = await prisma.goal.findUnique({ where: { id: req.params.goalId } });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const milestone = await prisma.milestone.update({
      where: { id: req.params.milestoneId },
      data: {
        ...(title && { title }),
        ...(progress !== undefined && { progress }),
        ...(status && { status }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
    });

    const io = req.app.get('io');
    io.to(`workspace:${goal.workspaceId}`).emit('milestone:updated', { goalId: goal.id, milestone });
    res.json({ milestone });
  } catch (err) { next(err); }
});

// POST /api/goals/:goalId/progress
router.post('/:goalId/progress', authenticate, [
  body('content').trim().isLength({ min: 1, max: 2000 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const goal = await prisma.goal.findUnique({ where: { id: req.params.goalId } });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const update = await prisma.progressUpdate.create({
      data: { goalId: req.params.goalId, userId: req.user.id, content: req.body.content },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    // Handle mentions
    const io = req.app.get('io');
    await processMentions({
      content: req.body.content,
      workspaceId: goal.workspaceId,
      sender: req.user,
      link: `/workspaces/${goal.workspaceId}/goals`,
      io
    });

    io.to(`workspace:${goal.workspaceId}`).emit('goal:progress_update', { goalId: goal.id, update });
    res.status(201).json({ update });
  } catch (err) { next(err); }
});

module.exports = router;
