const { prisma } = require('./prisma');
const { logger } = require('./logger');

async function createNotification({ userId, type, title, message, link }) {
  try {
    const notification = await prisma.notification.create({
      data: { userId, type, title, message, link },
    });
    return notification;
  } catch (err) {
    logger.error('Failed to create notification:', err);
  }
}

module.exports = { createNotification };
