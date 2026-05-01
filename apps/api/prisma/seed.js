const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo users
  const hashedPassword = await bcrypt.hash('jijan1234', 12);

  const alice = await prisma.user.upsert({
    where: { email: 'jijanur@gmail.com' },
    update: {},
    create: {
      email: 'jijanur@gmail.com',
      password: hashedPassword,
      name: 'Jijanur',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jijanur',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@demo.com' },
    update: {},
    create: {
      email: 'bob@demo.com',
      password: hashedPassword,
      name: 'Bob Smith',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: 'carol@demo.com' },
    update: {},
    create: {
      email: 'carol@demo.com',
      password: hashedPassword,
      name: 'Carol Williams',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=carol',
    },
  });

  // Create workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'acme-team' },
    update: {},
    create: {
      name: 'Acme Team',
      description: 'Main workspace for Acme Corporation engineering team',
      accentColor: '#6366f1',
      slug: 'acme-team',
      ownerId: alice.id,
    },
  });

  // Add members
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: alice.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: alice.id, role: 'ADMIN' },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: bob.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: bob.id, role: 'MEMBER' },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: carol.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: carol.id, role: 'MEMBER' },
  });

  // Create goals
  const goal1 = await prisma.goal.create({
    data: {
      title: 'Launch Q2 Product Update',
      description: 'Ship all planned features for the Q2 product release including new dashboard and API v2.',
      workspaceId: workspace.id,
      ownerId: alice.id,
      status: 'IN_PROGRESS',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const goal2 = await prisma.goal.create({
    data: {
      title: 'Improve System Performance',
      description: 'Reduce API response time by 40% and improve database query optimization.',
      workspaceId: workspace.id,
      ownerId: bob.id,
      status: 'IN_PROGRESS',
      dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    },
  });

  const goal3 = await prisma.goal.create({
    data: {
      title: 'Team Onboarding Documentation',
      description: 'Create comprehensive onboarding docs for new team members.',
      workspaceId: workspace.id,
      ownerId: carol.id,
      status: 'COMPLETED',
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  // Create milestones
  await prisma.milestone.createMany({
    data: [
      { title: 'Design mockups approved', goalId: goal1.id, progress: 100, status: 'COMPLETED' },
      { title: 'Backend API endpoints ready', goalId: goal1.id, progress: 75, status: 'IN_PROGRESS' },
      { title: 'Frontend integration', goalId: goal1.id, progress: 30, status: 'IN_PROGRESS' },
      { title: 'Database indexing', goalId: goal2.id, progress: 100, status: 'COMPLETED' },
      { title: 'Caching layer implementation', goalId: goal2.id, progress: 60, status: 'IN_PROGRESS' },
    ],
  });

  // Create announcements
  await prisma.announcement.create({
    data: {
      title: '🚀 Q2 Planning Kickoff',
      content: 'Welcome to our Q2 planning session! We have exciting goals ahead. Please review the updated roadmap and share your feedback by Friday.',
      workspaceId: workspace.id,
      authorId: alice.id,
      isPinned: true,
    },
  });

  await prisma.announcement.create({
    data: {
      title: '📅 Weekly Standup Schedule Updated',
      content: 'Starting next week, our daily standups will move from 9 AM to 9:30 AM to accommodate team members in different time zones.',
      workspaceId: workspace.id,
      authorId: alice.id,
      isPinned: false,
    },
  });

  // Create action items
  await prisma.actionItem.createMany({
    data: [
      {
        title: 'Set up CI/CD pipeline',
        description: 'Configure GitHub Actions for automated testing and deployment',
        workspaceId: workspace.id,
        goalId: goal1.id,
        assigneeId: bob.id,
        creatorId: alice.id,
        priority: 'HIGH',
        status: 'DONE',
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'Write API documentation',
        description: 'Document all new API endpoints with examples',
        workspaceId: workspace.id,
        goalId: goal1.id,
        assigneeId: carol.id,
        creatorId: alice.id,
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'Performance audit report',
        description: 'Run load tests and document bottlenecks',
        workspaceId: workspace.id,
        goalId: goal2.id,
        assigneeId: bob.id,
        creatorId: bob.id,
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'Update onboarding wiki',
        description: 'Add new sections for deployment and troubleshooting',
        workspaceId: workspace.id,
        goalId: goal3.id,
        assigneeId: carol.id,
        creatorId: carol.id,
        priority: 'LOW',
        status: 'TODO',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'Security vulnerability scan',
        description: 'Run OWASP scan on all endpoints',
        workspaceId: workspace.id,
        assigneeId: alice.id,
        creatorId: alice.id,
        priority: 'URGENT',
        status: 'TODO',
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // Create audit log
  await prisma.auditLog.createMany({
    data: [
      { workspaceId: workspace.id, userId: alice.id, action: 'CREATE', entityType: 'WORKSPACE', entityId: workspace.id, metadata: { name: workspace.name } },
      { workspaceId: workspace.id, userId: alice.id, action: 'CREATE', entityType: 'GOAL', entityId: goal1.id, metadata: { title: goal1.title } },
      { workspaceId: workspace.id, userId: bob.id, action: 'JOIN', entityType: 'WORKSPACE', entityId: workspace.id, metadata: {} },
    ],
  });

  console.log('✅ Database seeded successfully!');
  console.log('📧 Demo accounts:');
  console.log('   jijanur@gmail.com / jijan1234 (Admin)');
  console.log('   bob@demo.com   / jijan1234 (Member)');
  console.log('   carol@demo.com / jijan1234 (Member)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
