import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create/update test user - always reset password to 'test' for E2E tests
  const hashedPassword = await bcrypt.hash('test', 10);

  const user = await prisma.user.upsert({
    where: { email: 'test@test.com' },
    update: {
      password: hashedPassword,  // Always reset password for consistent E2E tests
    },
    create: {
      email: 'test@test.com',
      name: 'Test User',
      password: hashedPassword,
    },
  });

  console.log('✅ Created test user:', user.email);

  // Create organization for test user (required for login)
  const org = await prisma.organization.upsert({
    where: { id: 'test-org-id' },
    update: {},
    create: {
      id: 'test-org-id',
      name: 'Test Organization',
      slug: 'test-org',
    },
  });

  console.log('✅ Created test organization:', org.name);

  // Create organization membership for test user (using composite unique key)
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      organizationId: org.id,
      role: 'owner',
    },
  });

  console.log('✅ Created organization membership for test user');

  // Create test project with multiple URLs
  const project = await prisma.project.upsert({
    where: { id: 'test-project-id' },
    update: { organizationId: org.id },
    create: {
      id: 'test-project-id',
      name: 'Multi-Page E-commerce Site',
      description: 'Test project with multiple URLs for comprehensive testing',
      userId: user.id,
      organizationId: org.id,
    },
  });

  console.log('✅ Created test project:', project.name);

  // Create multiple URLs for the project
  const urls = [
    {
      url: 'https://demo.testim.io/',
      title: 'Homepage',
      description: 'Main landing page with navigation and hero section',
    },
    {
      url: 'https://demo.testim.io/login',
      title: 'Login Page',
      description: 'User authentication page',
    },
    {
      url: 'https://demo.testim.io/signup',
      title: 'Registration Page', 
      description: 'New user registration form',
    },
    {
      url: 'https://demo.testim.io/products',
      title: 'Products Page',
      description: 'Product catalog and search functionality',
    },
  ];

  for (const urlData of urls) {
    const projectUrl = await prisma.projectUrl.create({
      data: {
        ...urlData,
        projectId: project.id,
      },
    });
    console.log(`✅ Created project URL: ${projectUrl.title} - ${projectUrl.url}`);
  }

  // Create a sample test with starting URL
  const test = await prisma.test.create({
    data: {
      name: 'User Login Flow Test',
      description: 'Complete user authentication flow from homepage to dashboard',
      startingUrl: 'https://demo.testim.io/',
      projectId: project.id,
      steps: [
        {
          id: '1',
          type: 'navigate',
          selector: '',
          description: 'Navigate to homepage',
          timeout: 10000,
        },
        {
          id: '2', 
          type: 'click',
          selector: 'a[href="/login"]',
          description: 'Click login button',
          timeout: 5000,
        },
        {
          id: '3',
          type: 'type',
          selector: 'input[name="email"]',
          value: 'test@example.com',
          description: 'Enter email address',
          timeout: 5000,
        },
        {
          id: '4',
          type: 'type', 
          selector: 'input[name="password"]',
          value: 'password123',
          description: 'Enter password',
          timeout: 5000,
        },
        {
          id: '5',
          type: 'click',
          selector: 'button[type="submit"]',
          description: 'Submit login form',
          timeout: 5000,
        },
      ],
    },
  });

  console.log('✅ Created sample test:', test.name);

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });