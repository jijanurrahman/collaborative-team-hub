const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../utils/prisma');
const { authenticate, requirePermission } = require('../middleware/auth');
const { sendInvitationEmail } = require('../utils/email');
const { stringify } = require('csv-stringify/sync');
const { createAuditLog } = require('../utils/audit');

const router = express.Router();

// GET /api/workspaces — list user's workspaces
router.get('/', authenticate, async (req, res, next) => {
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.user.id },
      include: {
        workspace: {
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, email: true, avatarUrl: true } },
              },
            },
            _count: { select: { members: true, goals: true, actionItems: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    const workspaces = memberships.map(m => ({
      ...m.workspace,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
    res.json({ workspaces });
  } catch (err) { next(err); }
});

// POST /api/workspaces — create workspace
router.post('/', authenticate, [
  body('name').trim().isLength({ min: 2, max: 50 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('accentColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { name, description, accentColor } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + uuidv4().slice(0, 8);

    const workspace = await prisma.workspace.create({
      data: {
        name, description, accentColor: accentColor || '#6366f1', slug, ownerId: req.user.id,
        members: { create: { userId: req.user.id, role: 'ADMIN' } },
      },
      include: { _count: { select: { members: true } } },
    });

    await createAuditLog({ workspaceId: workspace.id, userId: req.user.id, action: 'CREATE', entityType: 'WORKSPACE', entityId: workspace.id, metadata: { name } });

    const io = req.app.get('io');
    io.to(`workspace:${workspace.id}`).emit('workspace:created', workspace);

    res.status(201).json({ workspace: { ...workspace, role: 'ADMIN' } });
  } catch (err) { next(err); }
});

// GET /api/workspaces/:workspaceId
router.get('/:workspaceId', authenticate, async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, isOnline: true, lastSeen: true } } },
        },
        _count: { select: { goals: true, actionItems: true, announcements: true } },
      },
    });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    res.json({ workspace: { ...workspace, role: member.role } });
  } catch (err) { next(err); }
});

// PATCH /api/workspaces/:workspaceId
router.patch('/:workspaceId', authenticate, requirePermission('edit:goal'), [
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('accentColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { name, description, accentColor } = req.body;
    const workspace = await prisma.workspace.update({
      where: { id: req.params.workspaceId },
      data: { ...(name && { name }), ...(description !== undefined && { description }), ...(accentColor && { accentColor }) },
    });

    const io = req.app.get('io');
    io.to(`workspace:${workspace.id}`).emit('workspace:updated', workspace);

    res.json({ workspace });
  } catch (err) { next(err); }
});

// POST /api/workspaces/:workspaceId/invite
router.post('/:workspaceId/invite', authenticate, requirePermission('invite:member'), [
  body('email').isEmail().normalizeEmail(),
  body('role').optional().isIn(['ADMIN', 'MEMBER', 'VIEWER']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { email, role = 'MEMBER' } = req.body;
    const { workspaceId } = req.params;

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    // Check if already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existing = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
      });
      if (existing) return res.status(409).json({ error: 'User already a member' });
    }

    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role,
        senderId: req.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const inviteLink = `${process.env.CLIENT_URL}/invite/${invitation.token}`;
    await sendInvitationEmail({ to: email, inviterName: req.user.name, workspaceName: workspace.name, inviteLink });

    await createAuditLog({ workspaceId, userId: req.user.id, action: 'INVITE', entityType: 'MEMBER', metadata: { email, role } });

    res.status(201).json({ invitation, message: 'Invitation sent', inviteLink });
  } catch (err) { next(err); }
});

// POST /api/workspaces/accept-invite/:token
router.post('/accept-invite/:token', authenticate, async (req, res, next) => {
  try {
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token: req.params.token },
      include: { workspace: true },
    });

    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.status !== 'PENDING') return res.status(400).json({ error: 'Invitation already used' });
    if (invitation.expiresAt < new Date()) return res.status(400).json({ error: 'Invitation expired' });
    if (invitation.email !== req.user.email) return res.status(403).json({ error: 'Invitation is for a different email' });

    const member = await prisma.workspaceMember.create({
      data: { workspaceId: invitation.workspaceId, userId: req.user.id, role: invitation.role },
    });

    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED' },
    });

    const io = req.app.get('io');
    io.to(`workspace:${invitation.workspaceId}`).emit('workspace:member_joined', {
      userId: req.user.id, name: req.user.name, role: member.role,
    });

    res.json({ workspace: invitation.workspace, member });
  } catch (err) { next(err); }
});

// PATCH /api/workspaces/:workspaceId/members/:userId/role
router.patch('/:workspaceId/members/:userId/role', authenticate, requirePermission('change:role'), [
  body('role').isIn(['ADMIN', 'MEMBER', 'VIEWER']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { workspaceId, userId } = req.params;
    const member = await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: { role: req.body.role },
    });

    await createAuditLog({ workspaceId, userId: req.user.id, action: 'CHANGE_ROLE', entityType: 'MEMBER', entityId: userId, metadata: { role: req.body.role } });
    res.json({ member });
  } catch (err) { next(err); }
});

// DELETE /api/workspaces/:workspaceId/members/:userId
router.delete('/:workspaceId/members/:userId', authenticate, requirePermission('remove:member'), async (req, res, next) => {
  try {
    const { workspaceId, userId } = req.params;
    await prisma.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId } } });

    const io = req.app.get('io');
    io.to(`workspace:${workspaceId}`).emit('workspace:member_removed', { userId });
    res.json({ message: 'Member removed' });
  } catch (err) { next(err); }
});

// GET /api/workspaces/:workspaceId/export
router.get('/:workspaceId/export', authenticate, requirePermission('export:data'), async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const [goals, actionItems, announcements] = await Promise.all([
      prisma.goal.findMany({ where: { workspaceId }, include: { owner: { select: { name: true } } } }),
      prisma.actionItem.findMany({ where: { workspaceId }, include: { assignee: { select: { name: true } }, creator: { select: { name: true } } } }),
      prisma.announcement.findMany({ where: { workspaceId }, include: { author: { select: { name: true } } } }),
    ]);

    const csvGoals = stringify(goals.map(g => ({
      Title: g.title, Status: g.status, Owner: g.owner?.name, DueDate: g.dueDate, CreatedAt: g.createdAt,
    })), { header: true });

    const csvItems = stringify(actionItems.map(i => ({
      Title: i.title, Status: i.status, Priority: i.priority, Assignee: i.assignee?.name, Creator: i.creator?.name, DueDate: i.dueDate,
    })), { header: true });

    const combined = `GOALS\n${csvGoals}\n\nACTION ITEMS\n${csvItems}`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="workspace-export.csv"');
    res.send(combined);
  } catch (err) { next(err); }
});

module.exports = router;
