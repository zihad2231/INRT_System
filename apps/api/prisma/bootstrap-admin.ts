import { PrismaClient, UserStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import { resolve } from 'node:path';

const repositoryEnv = resolve(process.cwd(), '../../.env');
try {
  process.loadEnvFile(repositoryEnv);
} catch {
  // Environment variables may be supplied by the deployment environment.
}

const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const organizationName = process.env.BOOTSTRAP_ORG_NAME?.trim();
const organizationSlug = process.env.BOOTSTRAP_ORG_SLUG?.trim().toLowerCase();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Configure it in the ignored root .env file.');
}
if (!username || !password || !organizationName || !organizationSlug) {
  throw new Error(
    'Set BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ORG_NAME, and BOOTSTRAP_ORG_SLUG in the ignored root .env file.',
  );
}
if (password.length < 10 || password.length > 72) {
  throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain 10–72 characters for bcrypt.');
}

const prisma = new PrismaClient();
const adminPermissionCodes = [
  'USER_VIEW', 'USER_CREATE', 'USER_UPDATE', 'ROLE_ASSIGN',
  'TEAM_VIEW', 'TEAM_CREATE', 'TEAM_MANAGE', 'TEAM_LEADER_ASSIGN',
  'PROJECT_VIEW', 'PROJECT_MANAGE',
  'PAPER_VIEW', 'PAPER_ASSIGN', 'PAPER_REVIEW',
  'TASK_VIEW', 'TASK_CREATE', 'TASK_MANAGE',
  'NOTICE_CREATE_CENTRAL', 'NOTICE_CREATE_TEAM', 'NOTICE_CREATE_INDIVIDUAL', 'NOTICE_MANAGE',
  'ASSET_MANAGE', 'REPORT_EXPORT', 'AUDIT_VIEW',
] as const;

try {
  if (password.length < 12) {
    console.warn('Bootstrap password is shorter than the recommended 12 characters; rotate it before production.');
  }
  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.upsert({
      where: { slug: organizationSlug },
      create: { name: organizationName, slug: organizationSlug },
      update: {},
    });

    const permissionRecords = await Promise.all(
      adminPermissionCodes.map((code) =>
        tx.permission.upsert({
          where: { code },
          create: {
            code,
            name: code.toLowerCase().replaceAll('_', ' '),
            module: code.split('_')[0] ?? 'SYSTEM',
            action: code.split('_').at(-1) ?? 'MANAGE',
          },
          update: {},
          select: { id: true },
        }),
      ),
    );

    const adminRole = await tx.role.upsert({
      where: {
        organizationId_code: { organizationId: organization.id, code: 'SUPER_ADMIN' },
      },
      create: {
        organizationId: organization.id,
        name: 'Super Admin',
        code: 'SUPER_ADMIN',
        description: 'Organization-wide bootstrap administrator',
        isSystemRole: true,
      },
      update: { isSystemRole: true },
      select: { id: true },
    });

    await tx.rolePermission.createMany({
      data: permissionRecords.map(({ id }) => ({ roleId: adminRole.id, permissionId: id })),
      skipDuplicates: true,
    });

    const email = `${username.toLowerCase()}@local.intellinova.invalid`;
    const existing = await tx.user.findFirst({
      where: { organizationId: organization.id, memberCode: username },
      select: { id: true },
    });

    if (existing) {
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: existing.id, roleId: adminRole.id } },
        create: { userId: existing.id, roleId: adminRole.id },
        update: {},
      });
      return { organization: organization.name, username, created: false };
    }

    const passwordHash = await hash(password, 12);
    const adminUser = await tx.user.create({
      data: {
        organizationId: organization.id,
        memberCode: username,
        email,
        passwordHash,
        firstName: organizationName,
        lastName: 'Admin',
        fullName: `${organizationName} Admin`,
        status: UserStatus.ACTIVE,
        joiningDate: new Date(),
      },
      select: { id: true },
    });

    await tx.userRole.create({
      data: { userId: adminUser.id, roleId: adminRole.id },
    });

    return { organization: organization.name, username, created: true };
  }, { maxWait: 30_000, timeout: 120_000 });

  console.log(
    result.created
      ? `Bootstrap admin created for ${result.organization} (${result.username}).`
      : `Bootstrap admin already exists for ${result.organization} (${result.username}); existing password was not changed.`,
  );
} finally {
  await prisma.$disconnect();
}
