const { verifyAccessToken } = require('../utils/jwt');
const { prisma } = require('../utils/prisma');

async function authenticate(req, res, next) {
  try {
    const token = req.cookies.access_token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function requireWorkspaceRole(roles = []) {
  return async (req, res, next) => {
    try {
      const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;
      if (!workspaceId) return res.status(400).json({ error: 'Workspace ID required' });

      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
      });

      if (!member) {
        return res.status(403).json({ error: 'Not a member of this workspace' });
      }

      if (roles.length > 0 && !roles.includes(member.role)) {
        return res.status(403).json({ error: `Requires ${roles.join(' or ')} role` });
      }

      req.member = member;
      req.workspaceId = workspaceId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// RBAC permission matrix
const PERMISSIONS = {
  ADMIN: ['create:goal', 'edit:goal', 'delete:goal', 'create:announcement', 'edit:announcement',
          'delete:announcement', 'invite:member', 'remove:member', 'change:role', 'create:action',
          'edit:action', 'delete:action', 'pin:announcement', 'export:data', 'view:audit'],
  MEMBER: ['create:goal', 'edit:goal', 'create:action', 'edit:action', 'comment', 'react', 'view:audit'],
  VIEWER: ['comment', 'react'],
};

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      let workspaceId = req.params.workspaceId || req.workspaceId || req.body.workspaceId || req.query.workspaceId;
      
      if (!workspaceId) {
        if (req.params.goalId) {
          const g = await prisma.goal.findUnique({ where: { id: req.params.goalId }, select: { workspaceId: true } });
          workspaceId = g?.workspaceId;
        } else if (req.params.announcementId) {
          const a = await prisma.announcement.findUnique({ where: { id: req.params.announcementId }, select: { workspaceId: true } });
          workspaceId = a?.workspaceId;
        } else if (req.params.itemId) {
          const i = await prisma.actionItem.findUnique({ where: { id: req.params.itemId }, select: { workspaceId: true } });
          workspaceId = i?.workspaceId;
        }
      }

      if (!workspaceId) return res.status(400).json({ error: 'Workspace ID required' });

      const member = req.member || await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
      });

      if (!member) {
        return res.status(403).json({ error: 'Not a workspace member' });
      }

      const allowedPermissions = PERMISSIONS[member.role] || [];
      if (!allowedPermissions.includes(permission)) {
        return res.status(403).json({
          error: `Permission denied: requires '${permission}' permission`,
          yourRole: member.role,
        });
      }

      req.member = member;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { authenticate, requireWorkspaceRole, requirePermission, PERMISSIONS };
