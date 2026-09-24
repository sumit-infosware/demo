import { prisma } from "../src/config/clients.js";
import { PERMISSIONS } from "../src/constants/permissions.js";
import { ROLES } from "../src/constants/roles.js";
import { authHelper } from "../src/helpers/auth.helper.js";

async function main() {
  // ─── Permissions ─────────────────────────────────────────────
  // Idempotent: upsert by unique `code` so the seed is safe to run repeatedly.
  const permissionDefs: { code: string; description: string }[] = [
    { code: PERMISSIONS.USER_READ, description: "Allows reading user records" },
    { code: PERMISSIONS.USER_CREATE, description: "Allows creating user records" },
    { code: PERMISSIONS.USER_UPDATE, description: "Allows updating user records" },
    { code: PERMISSIONS.USER_DELETE, description: "Allows deleting user records" },
    { code: PERMISSIONS.ADMIN_ACCESS, description: "Grants access to admin-only operations" },
    { code: PERMISSIONS.ROLE_CREATE, description: "Allows creating roles" },
    { code: PERMISSIONS.ROLE_READ, description: "Allows reading roles" },
    { code: PERMISSIONS.ROLE_UPDATE, description: "Allows updating roles" },
    { code: PERMISSIONS.ROLE_DELETE, description: "Allows deleting roles" },
    { code: PERMISSIONS.PERMISSION_CREATE, description: "Allows creating permissions" },
    { code: PERMISSIONS.PERMISSION_READ, description: "Allows reading permissions" },
    { code: PERMISSIONS.PERMISSION_UPDATE, description: "Allows updating permissions" },
    { code: PERMISSIONS.PERMISSION_DELETE, description: "Allows deleting permissions" },
    { code: PERMISSIONS.RR_READ, description: "Allows reading Receiving Report data" },
    { code: PERMISSIONS.RR_FETCH, description: "Allows fetching RR data from IFS" },
    {
      code: PERMISSIONS.IFS_FETCH,
      description: "Allows triggering manual IFS fetch (all or single gate entry)",
    },
    {
      code: PERMISSIONS.IFS_POLL_CONTROL,
      description: "Allows starting/stopping/restarting the IFS poller",
    },
    {
      code: PERMISSIONS.IFS_POLL_CONFIG_READ,
      description: "Allows reading the IFS polling configuration",
    },
    {
      code: PERMISSIONS.IFS_POLL_CONFIG_WRITE,
      description: "Allows updating the IFS polling configuration",
    },
    {
      code: PERMISSIONS.IFS_POLL_STATE_READ,
      description: "Allows reading the IFS polling state",
    },
    {
      code: PERMISSIONS.TAG_CREATE,
      description: "Allows creating packet tags (start tagging session)",
    },
    { code: PERMISSIONS.TAG_READ, description: "Allows reading packet tags" },
    {
      code: PERMISSIONS.TAG_COMMISSION,
      description: "Allows commissioning (verifying) a printed tag",
    },
    { code: PERMISSIONS.TAG_PRINT, description: "Allows retrieving a label payload for printing" },
    { code: PERMISSIONS.BASELINE_CREATE, description: "Allows creating baseline counts" },
    { code: PERMISSIONS.BASELINE_READ, description: "Allows reading baseline records" },
    { code: PERMISSIONS.BASELINE_UPDATE, description: "Allows updating baseline records" },
    { code: PERMISSIONS.DEVICE_READ, description: "Allows reading device registry" },
    { code: PERMISSIONS.DEVICE_MANAGE, description: "Allows managing devices (CRUD)" },
    { code: PERMISSIONS.DEVICE_INVOKE, description: "Allows invoking physical devices" },
    { code: PERMISSIONS.ALERT_READ, description: "Allows reading alerts" },
    { code: PERMISSIONS.ALERT_ACKNOWLEDGE, description: "Allows acknowledging alerts" },
    { code: PERMISSIONS.VARIANCE_READ, description: "Allows reading variance records" },
    { code: PERMISSIONS.VARIANCE_RESOLVE, description: "Allows resolving variance disposition" },
    {
      code: PERMISSIONS.TRANSIT_CHARGE_CHECK,
      description: "Allows checking charge approval at the transit exit",
    },
    {
      code: PERMISSIONS.TRANSIT_SELECT_APPROVED,
      description: "Allows selecting the approved subset of EPCs for dispatch",
    },
    {
      code: PERMISSIONS.TRANSIT_GENERATE_TRANSFER,
      description: "Generate transfer for approved EPCs",
    },
    {
      code: PERMISSIONS.TRANSIT_ALERT_CREATE,
      description: "Allows raising transit-exit not-approved alerts",
    },
    {
      code: PERMISSIONS.TRANSIT_DOOR_READ,
      description: "Allows reading EPCs at the transit door",
    },
    // ─── Holding Receive (Phase 6) ───────────────────────
    { code: PERMISSIONS.HOLDING_SCAN, description: "Allows scanning trolley at Holding entry" },
    { code: PERMISSIONS.HOLDING_RECEIVE, description: "Allows receiving transfers at Holding" },
    {
      code: PERMISSIONS.HOLDING_RECONCILE,
      description: "Allows reconciling alternate items at Holding",
    },

    // ─── Count Check (Phase 7) ───────────────────────────
    { code: PERMISSIONS.COUNTCHECK_CREATE, description: "Allows capturing count check at Holding" },
    { code: PERMISSIONS.COUNTCHECK_READ, description: "Allows reading count checks" },
    {
      code: PERMISSIONS.COUNTCHECK_OVERRIDE,
      description: "Allows overriding count check tolerance",
    },

    // ════════════════════════════════════════════════════════════
    // ─── NEW v2.0 PERMISSIONS (Diagram Aligned) ─────────────────
    // ════════════════════════════════════════════════════════════

    // ─── Line Count (Phase 2) ───────────────────────────────────
    {
      code: PERMISSIONS.LINE_COUNT_CREATE,
      description: "Allows capturing line-level counts before tagging",
    },
    { code: PERMISSIONS.LINE_COUNT_READ, description: "Allows reading line count records" },
    {
      code: PERMISSIONS.LINE_COUNT_APPROVE,
      description: "Allows approving line counts with variances",
    },

    // ─── Ownership (Phase 1) ────────────────────────────────────
    {
      code: PERMISSIONS.OWNERSHIP_SET,
      description: "Allows setting HAL/OTHER ownership for an RR Line",
    },

    // ─── Tag Enhancements (Phase 4) ─────────────────────────────
    { code: PERMISSIONS.TAG_VOID, description: "Allows voiding a printed tag and reprinting" },
    {
      code: PERMISSIONS.HANDHELD_PHOTO_UPLOAD,
      description: "Allows uploading top-marking photos from Handheld",
    },

    // ─── Put Away (Phase 9) ─────────────────────────────────────
    {
      code: PERMISSIONS.PUT_AWAY_SYNC,
      description: "Allows syncing offline storage confirmations from handhelds",
    },
    {
      code: PERMISSIONS.BINNING_PLAN_READ,
      description: "Allows reading Bins",
    },
    // ─── Binning (Phase 9) ─────────────────────────────────────
    {
      code: PERMISSIONS.BINNING_CONFIRM,
      description: "Allows confirming binning operations",
    },
    {
      code: PERMISSIONS.BINNING_LOCATION_READ,
      description: "Allows reading binning/storage locations",
    },
    {
      code: PERMISSIONS.BINNING_LOCATION_MANAGE,
      description: "Allows managing binning/storage locations",
    },

    // ─── Asset Transfer & Storage ──────────────────────────────
    {
      code: PERMISSIONS.ASSET_TRANSFER_READ,
      description: "Allows reading transfers, storage locations, and asset lookups",
    },
    { code: PERMISSIONS.IFS_POLL_CONFIG_UPDATE, description: "Update IFS polling config" },
    { code: PERMISSIONS.IFS_STOCK_VERIFICATION_READ, description: "Read stock verification runs" },
    { code: PERMISSIONS.IFS_STOCK_VERIFICATION_RUN, description: "Run stock verification" },
  ];

  for (const def of permissionDefs) {
    await prisma.permission.upsert({
      where: { code: def.code },
      update: { description: def.description },
      create: def,
    });
  }

  // ─── Roles ───────────────────────────────────────────────────
  // Seed distinct system roles: ADMIN, USER, TRANSIT_MANAGER, HOLDING_MANAGER, SECURITY
  const adminRole = await prisma.role.upsert({
    where: { name: ROLES.ADMIN },
    update: {},
    create: { name: ROLES.ADMIN, description: "Administrator with full access", isSystem: true },
  });

  const userRole = await prisma.role.upsert({
    where: { name: ROLES.USER },
    update: {},
    create: {
      name: ROLES.USER,
      description: "Standard authenticated user with read-only access",
      isSystem: true,
    },
  });

  const transitManagerRole = await prisma.role.upsert({
    where: { name: ROLES.TRANSIT_MANAGER },
    update: {},
    create: {
      name: ROLES.TRANSIT_MANAGER,
      description: "Transit manager — recipient of transit-exit anomaly alerts",
      isSystem: true,
    },
  });

  const holdingManagerRole = await prisma.role.upsert({
    where: { name: ROLES.HOLDING_MANAGER },
    update: {},
    create: {
      name: ROLES.HOLDING_MANAGER,
      description: "Holding manager — recipient of transit-exit anomaly alerts",
      isSystem: true,
    },
  });

  const securityRole = await prisma.role.upsert({
    where: { name: ROLES.SECURITY },
    update: {},
    create: {
      name: ROLES.SECURITY,
      description: "Security (anti-theft alarm audience)",
      isSystem: true,
    },
  });

  // ─── Role ↔ Permission assignments ──────────────────────────
  // Admin receives EVERY permission defined in the system (full access).
  const allPermissions = await prisma.permission.findMany({ select: { id: true } });
  await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
  await prisma.rolePermission.createMany({
    data: allPermissions.map((p: { id: string }) => ({ roleId: adminRole.id, permissionId: p.id })),
  });

  // User receives read permissions.
  const userPermissions = await prisma.permission.findMany({
    where: {
      OR: [
        { code: { endsWith: ".read" } },
        { code: { endsWith: "_read" } },
        { code: { contains: "read" } },
      ],
    },
    select: { id: true },
  });
  await prisma.rolePermission.deleteMany({ where: { roleId: userRole.id } });
  await prisma.rolePermission.createMany({
    data: userPermissions.map((p: { id: string }) => ({ roleId: userRole.id, permissionId: p.id })),
  });

  // Manager roles receive the transit-exit alert permission (RF-25) and relevant read permissions.
  const alertPermission = await prisma.permission.findUnique({
    where: { code: PERMISSIONS.TRANSIT_ALERT_CREATE },
    select: { id: true },
  });
  if (alertPermission) {
    for (const role of [transitManagerRole, holdingManagerRole]) {
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: alertPermission.id },
      });
    }
  }

  const alertReadPermission = await prisma.permission.findUnique({
    where: { code: PERMISSIONS.ALERT_READ },
    select: { id: true },
  });
  if (alertReadPermission) {
    await prisma.rolePermission.deleteMany({ where: { roleId: securityRole.id } });
    await prisma.rolePermission.create({
      data: { roleId: securityRole.id, permissionId: alertReadPermission.id },
    });
  }

  // ─── Users ───────────────────────────────────────────────────
  // Seed at least 7 demo accounts across all roles so list endpoints return >= 5 items.
  const usersToSeed = [
    {
      email: "admin@gmail.com",
      password: "Admin@1234",
      firstName: "Admin",
      lastName: "User",
      roleId: adminRole.id,
    },
    {
      email: "user@gmail.com",
      password: "User@1234",
      firstName: "Readonly",
      lastName: "User",
      roleId: userRole.id,
    },
    {
      email: "warehouse.manager@gmail.com",
      password: "Warehouse@1234",
      firstName: "Warehouse",
      lastName: "Manager",
      roleId: holdingManagerRole.id,
    },
    {
      email: "transit.manager@gmail.com",
      password: "Transit@1234",
      firstName: "Transit",
      lastName: "Manager",
      roleId: transitManagerRole.id,
    },
    {
      email: "security.operator@gmail.com",
      password: "Security@1234",
      firstName: "Security",
      lastName: "Operator",
      roleId: securityRole.id,
    },
    {
      email: "operator.one@gmail.com",
      password: "Operator@1234",
      firstName: "Primary",
      lastName: "Operator",
      roleId: userRole.id,
    },
    {
      email: "qc.inspector@gmail.com",
      password: "Inspector@1234",
      firstName: "QC",
      lastName: "Inspector",
      roleId: userRole.id,
    },
  ];

  for (const u of usersToSeed) {
    const passwordHash = await authHelper.encryptPassword(u.password);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { password: passwordHash, firstName: u.firstName, lastName: u.lastName },
      create: {
        email: u.email,
        password: passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
      },
    });

    // Assign the role (idempotent: delete existing links, then recreate).
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: u.roleId } });
  }

  console.log(" Seed complete: roles, v2.0 permissions and users upserted.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
