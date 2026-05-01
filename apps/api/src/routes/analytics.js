const express = require('express');
const { prisma } = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics?workspaceId=xxx
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [totalGoals, completedGoals, overdueGoals, totalItems, completedThisWeek, overdueItems, totalMembers, goalsByStatus, itemsByStatus] = await Promise.all([
      prisma.goal.count({ where: { workspaceId } }),
      prisma.goal.count({ where: { workspaceId, status: 'COMPLETED' } }),
      prisma.goal.count({ where: { workspaceId, dueDate: { lt: new Date() }, status: { not: 'COMPLETED' } } }),
      prisma.actionItem.count({ where: { workspaceId } }),
      prisma.actionItem.count({ where: { workspaceId, status: 'DONE', updatedAt: { gte: startOfWeek } } }),
      prisma.actionItem.count({ where: { workspaceId, dueDate: { lt: new Date() }, status: { not: 'DONE' } } }),
      prisma.workspaceMember.count({ where: { workspaceId } }),
      prisma.goal.groupBy({ by: ['status'], where: { workspaceId }, _count: true }),
      prisma.actionItem.groupBy({ by: ['status'], where: { workspaceId }, _count: true }),
    ]);

    const chartData = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const [completed, created] = await Promise.all([
        prisma.goal.count({ where: { workspaceId, status: 'COMPLETED', updatedAt: { gte: weekStart, lt: weekEnd } } }),
        prisma.goal.count({ where: { workspaceId, createdAt: { gte: weekStart, lt: weekEnd } } }),
      ]);
      chartData.push({ week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), completed, created });
    }

    res.json({
      stats: { totalGoals, completedGoals, overdueGoals, totalItems, completedThisWeek, overdueItems, totalMembers, completionRate: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0 },
      goalsByStatus: goalsByStatus.map(g => ({ status: g.status, count: g._count })),
      itemsByStatus: itemsByStatus.map(i => ({ status: i.status, count: i._count })),
      chartData,
    });
  } catch (err) { next(err); }
});

module.exports = router;
