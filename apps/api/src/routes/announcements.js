const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../utils/prisma');
const { authenticate, requirePermission } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { createNotification } = require('../utils/notifications');
const { sendMentionEmail } = require('../utils/email');

const router = express.Router();

// GET /api/announcements?workspaceId=xxx
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { workspaceId, limit = 20, offset = 0 } = req.query;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const [pinned, regular] = await Promise.all([
      prisma.announcement.findMany({
        where: { workspaceId, isPinned: true },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          reactions: { include: { user: { select: { id: true, name: true } } } },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.announcement.findMany({
        where: { workspaceId, isPinned: false },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          reactions: { include: { user: { select: { id: true, name: true } } } },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
    ]);

    res.json({ announcements: [...pinned, ...regular] });
  } catch (err) { next(err); }
});

// POST /api/announcements
router.post('/', authenticate, requirePermission('create:announcement'), [
  body('title').trim().isLength({ min: 2, max: 200 }),
  body('content').trim().isLength({ min: 1 }),
  body('workspaceId').isUUID(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { title, content, workspaceId } = req.body;
    const announcement = await prisma.announcement.create({
      data: { title, content, workspaceId, authorId: req.user.id },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        reactions: true,
        _count: { select: { comments: true } },
      },
    });

    await createAuditLog({ workspaceId, userId: req.user.id, action: 'CREATE', entityType: 'ANNOUNCEMENT', entityId: announcement.id, metadata: { title } });

    // Notify all workspace members
    const members = await prisma.workspaceMember.findMany({ where: { workspaceId }, select: { userId: true } });
    await Promise.all(
      members.filter(m => m.userId !== req.user.id).map(m =>
        createNotification({
          userId: m.userId, type: 'ANNOUNCEMENT', title: 'New Announcement',
          message: `${req.user.name} posted: ${title}`,
          link: `/workspaces/${workspaceId}/announcements/${announcement.id}`,
        })
      )
    );

    const io = req.app.get('io');
    io.to(`workspace:${workspaceId}`).emit('announcement:created', announcement);

    res.status(201).json({ announcement });
  } catch (err) { next(err); }
});

// GET /api/announcements/:announcementId
router.get('/:announcementId', authenticate, async (req, res, next) => {
  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id: req.params.announcementId },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        reactions: { include: { user: { select: { id: true, name: true } } } },
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
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: announcement.workspaceId, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Not a member' });

    res.json({ announcement });
  } catch (err) { next(err); }
});

// PATCH /api/announcements/:announcementId
router.patch('/:announcementId', authenticate, requirePermission('edit:announcement'), [
  body('title').optional().trim().isLength({ min: 2, max: 200 }),
  body('content').optional().trim(),
  body('isPinned').optional().isBoolean(),
], async (req, res, next) => {
  try {
    const { title, content, isPinned } = req.body;
    const announcement = await prisma.announcement.update({
      where: { id: req.params.announcementId },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(isPinned !== undefined && { isPinned }),
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const io = req.app.get('io');
    io.to(`workspace:${announcement.workspaceId}`).emit('announcement:updated', announcement);
    res.json({ announcement });
  } catch (err) { next(err); }
});

// POST /api/announcements/:announcementId/pin
router.post('/:announcementId/pin', authenticate, requirePermission('pin:announcement'), async (req, res, next) => {
  try {
    const ann = await prisma.announcement.findUnique({ where: { id: req.params.announcementId } });
    if (!ann) return res.status(404).json({ error: 'Not found' });

    const announcement = await prisma.announcement.update({
      where: { id: req.params.announcementId },
      data: { isPinned: !ann.isPinned },
    });

    const io = req.app.get('io');
    io.to(`workspace:${announcement.workspaceId}`).emit('announcement:pinned', { id: announcement.id, isPinned: announcement.isPinned });
    res.json({ announcement });
  } catch (err) { next(err); }
});

// POST /api/announcements/:announcementId/react
router.post('/:announcementId/react', authenticate, [
  body('emoji').trim().notEmpty(),
], async (req, res, next) => {
  try {
    const { emoji } = req.body;
    const { announcementId } = req.params;

    const announcement = await prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement) return res.status(404).json({ error: 'Not found' });

    const existing = await prisma.reaction.findFirst({
      where: { announcementId, userId: req.user.id, emoji },
    });

    let action;
    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
      action = 'removed';
    } else {
      await prisma.reaction.create({ data: { announcementId, userId: req.user.id, emoji } });
      action = 'added';
    }

    const reactions = await prisma.reaction.findMany({
      where: { announcementId },
      include: { user: { select: { id: true, name: true } } },
    });

    const io = req.app.get('io');
    io.to(`workspace:${announcement.workspaceId}`).emit('announcement:reacted', { announcementId, reactions, action, emoji, userId: req.user.id });

    res.json({ reactions, action });
  } catch (err) { next(err); }
});

// POST /api/announcements/:announcementId/comments
router.post('/:announcementId/comments', authenticate, [
  body('content').trim().isLength({ min: 1, max: 2000 }),
  body('parentId').optional().isUUID(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { content, parentId } = req.body;
    const { announcementId } = req.params;
    const announcement = await prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement) return res.status(404).json({ error: 'Not found' });

    const comment = await prisma.comment.create({
      data: { content, authorId: req.user.id, announcementId, parentId: parentId || null },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        reactions: true,
        replies: { include: { author: { select: { id: true, name: true, avatarUrl: true } } } },
      },
    });

    // Extract @mentions
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      const mentionedUserId = match[2];
      await prisma.mention.create({ data: { commentId: comment.id, userId: mentionedUserId } });
      await createNotification({
        userId: mentionedUserId, type: 'MENTION',
        title: `${req.user.name} mentioned you`,
        message: content.substring(0, 100),
        link: `/workspaces/${announcement.workspaceId}/announcements/${announcementId}`,
      });
      // Email notification
      const mentionedUser = await prisma.user.findUnique({ where: { id: mentionedUserId } });
      if (mentionedUser) {
        await sendMentionEmail({
          to: mentionedUser.email, mentionerName: req.user.name,
          workspaceName: 'the workspace', context: content.substring(0, 200),
          link: `${process.env.CLIENT_URL}/workspaces/${announcement.workspaceId}/announcements/${announcementId}`,
        });
      }

      const io = req.app.get('io');
      io.to(`user:${mentionedUserId}`).emit('notification:new', { type: 'MENTION', userId: mentionedUserId });
    }

    const io = req.app.get('io');
    io.to(`workspace:${announcement.workspaceId}`).emit('comment:created', { announcementId, comment });
    res.status(201).json({ comment });
  } catch (err) { next(err); }
});

// DELETE /api/announcements/:announcementId
router.delete('/:announcementId', authenticate, requirePermission('delete:announcement'), async (req, res, next) => {
  try {
    const ann = await prisma.announcement.findUnique({ where: { id: req.params.announcementId } });
    if (!ann) return res.status(404).json({ error: 'Not found' });

    await prisma.announcement.delete({ where: { id: req.params.announcementId } });
    const io = req.app.get('io');
    io.to(`workspace:${ann.workspaceId}`).emit('announcement:deleted', { id: ann.id });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
