const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { uploadAvatar } = require('../utils/cloudinary');

const router = express.Router();

// GET /api/users/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, avatarUrl: true, isOnline: true, lastSeen: true, createdAt: true },
    });
    res.json({ user });
  } catch (err) { next(err); }
});

// PATCH /api/users/me
router.patch('/me', authenticate, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { name } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { ...(name && { name }) },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });
    res.json({ user });
  } catch (err) { next(err); }
});

// POST /api/users/me/avatar
router.post('/me/avatar', authenticate, uploadAvatar.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: req.file.path },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    res.json({ user });
  } catch (err) { next(err); }
});

// GET /api/users/search?q=name&workspaceId=xxx
router.get('/search', authenticate, async (req, res, next) => {
  try {
    const { q, workspaceId } = req.query;
    if (!q || q.length < 2) return res.json({ users: [] });

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
        ...(workspaceId && {
          workspaceMemberships: { some: { workspaceId } },
        }),
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      take: 10,
    });
    res.json({ users });
  } catch (err) { next(err); }
});

module.exports = router;
