const { prisma } = require('./prisma');
const { createNotification } = require('./notifications');
const { sendMentionEmail } = require('./email');

/**
 * Extracts mentions from content and sends notifications/emails.
 * Supports both structured mentions @[Name](UserID) and plain text mentions @Name.
 */
async function processMentions({ content, workspaceId, sender, link, io }) {
  if (!content) return;

  const mentionedUserIds = new Set();

  // 1. Extract structured mentions: @[Name](UserID)
  const structuredRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = structuredRegex.exec(content)) !== null) {
    mentionedUserIds.add(match[2]);
  }

  // 2. Extract plain text mentions: @Name
  // We fetch all workspace members and check if their name is mentioned
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } }
  });

  for (const m of members) {
    if (m.userId === sender.id) continue;
    if (mentionedUserIds.has(m.userId)) continue;

    // Use regex to find @Name with word boundaries to avoid partial matches (e.g. @John matching @Johnathan)
    // We escape the name just in case it contains special regex characters
    const escapedName = m.user.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const plainRegex = new RegExp(`@${escapedName}\\b`, 'g');
    
    if (plainRegex.test(content)) {
      mentionedUserIds.add(m.userId);
    }
  }

  // 3. Process each unique mentioned user
  const mentionPromises = Array.from(mentionedUserIds).map(async (userId) => {
    try {
      // Create In-App Notification
      await createNotification({
        userId,
        type: 'MENTION',
        title: `${sender.name} mentioned you`,
        message: content.replace(/<[^>]*>/g, '').substring(0, 100), // Strip HTML for message
        link,
      });

      // Send Email Notification
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user && user.email) {
        await sendMentionEmail({
          to: user.email,
          mentionerName: sender.name,
          workspaceName: 'a workspace',
          context: content.replace(/<[^>]*>/g, '').substring(0, 200),
          link: `${process.env.CLIENT_URL}${link}`,
        });
      }

      // Real-time Socket Notification
      if (io) {
        io.to(`user:${userId}`).emit('notification:new', { type: 'MENTION', userId });
      }
    } catch (err) {
      console.error(`Failed to process mention for user ${userId}:`, err);
    }
  });

  await Promise.all(mentionPromises);
}

module.exports = { processMentions };
