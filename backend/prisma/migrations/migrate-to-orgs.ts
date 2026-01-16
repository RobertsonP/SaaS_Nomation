import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateToOrganizations() {
  console.log('🚀 Starting migration to Organizations...');

  try {
    // 1. Get all users
    const users = await prisma.user.findMany({
      include: {
        projects: true,
        memberships: true
      }
    });

    console.log(`Found ${users.length} users to migrate.`);

    for (const user of users) {
      // Check if user already has an organization (idempotency check)
      if (user.memberships.length > 0) {
        console.log(`User ${user.email} already has memberships. Skipping.`);
        continue;
      }

      console.log(`Migrating user: ${user.email}`);

      // 2. Create "Personal Workspace" for the user
      const orgName = `${user.name}'s Workspace`;
      const orgSlug = `user-${user.id.substring(0, 8)}-${Date.now()}`; // Ensure uniqueness

      const org = await prisma.organization.create({
        data: {
          name: orgName,
          slug: orgSlug,
          plan: 'free',
          members: {
            create: {
              userId: user.id,
              role: 'owner'
            }
          }
        }
      });

      console.log(`  ✅ Created Organization: ${org.name} (${org.id})`);

      // 3. Move all user's projects to this organization
      if (user.projects.length > 0) {
        const updateResult = await prisma.project.updateMany({
          where: {
            userId: user.id
          },
          data: {
            organizationId: org.id
          }
        });
        console.log(`  ✅ Moved ${updateResult.count} projects to organization.`);
      }
    }

    console.log('🏁 Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateToOrganizations();
