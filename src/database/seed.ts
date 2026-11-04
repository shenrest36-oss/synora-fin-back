import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password';

const prisma = new PrismaClient();

export async function seedDefaultData(): Promise<void> {
  const permissions = [
    { code: 'DASHBOARD_VIEW', module: 'DASHBOARD', name: 'View Dashboard' },
    { code: 'USER_VIEW', module: 'USERS', name: 'View Users' },
    { code: 'USER_CREATE', module: 'USERS', name: 'Create Users' },
    { code: 'USER_UPDATE', module: 'USERS', name: 'Update Users' },
    { code: 'USER_DELETE', module: 'USERS', name: 'Delete Users' },
    { code: 'ROLE_VIEW', module: 'ROLES', name: 'View Roles' },
    { code: 'ROLE_CREATE', module: 'ROLES', name: 'Create Roles' },
    { code: 'ROLE_UPDATE', module: 'ROLES', name: 'Update Roles' },
    { code: 'ROLE_DELETE', module: 'ROLES', name: 'Delete Roles' },
    { code: 'COMPANY_VIEW', module: 'COMPANY', name: 'View Company' },
    { code: 'COMPANY_UPDATE', module: 'COMPANY', name: 'Update Company' },
    { code: 'COA_VIEW', module: 'COA', name: 'View Chart of Accounts' },
    { code: 'COA_CREATE', module: 'COA', name: 'Create Chart of Accounts' },
    { code: 'COA_UPDATE', module: 'COA', name: 'Update Chart of Accounts' },
    { code: 'COA_DEACTIVATE', module: 'COA', name: 'Deactivate Chart of Accounts' },
    { code: 'COA_IMPORT', module: 'COA', name: 'Import Chart of Accounts' },
    { code: 'COA_EXPORT', module: 'COA', name: 'Export Chart of Accounts' },
    { code: 'ACCOUNT_CATEGORY_VIEW', module: 'ACCOUNTING', name: 'View Account Categories' },
    { code: 'ACCOUNT_CATEGORY_CREATE', module: 'ACCOUNTING', name: 'Create Account Categories' },
    { code: 'ACCOUNT_CATEGORY_UPDATE', module: 'ACCOUNTING', name: 'Update Account Categories' },
    { code: 'ACCOUNT_SUBCATEGORY_VIEW', module: 'ACCOUNTING', name: 'View Account Subcategories' },
    { code: 'ACCOUNT_SUBCATEGORY_CREATE', module: 'ACCOUNTING', name: 'Create Account Subcategories' },
    { code: 'ACCOUNT_SUBCATEGORY_UPDATE', module: 'ACCOUNTING', name: 'Update Account Subcategories' },
    { code: 'ACCOUNT_TYPE_VIEW', module: 'ACCOUNTING', name: 'View Account Types' },
    { code: 'JOURNAL_VIEW', module: 'JOURNAL', name: 'View Journal Entries' },
    { code: 'JOURNAL_CREATE', module: 'JOURNAL', name: 'Create Journal Entries' },
    { code: 'JOURNAL_UPDATE', module: 'JOURNAL', name: 'Update Journal Entries' },
    { code: 'JOURNAL_SUBMIT', module: 'JOURNAL', name: 'Submit Journal Entries' },
    { code: 'JOURNAL_APPROVE', module: 'JOURNAL', name: 'Approve Journal Entries' },
    { code: 'JOURNAL_REJECT', module: 'JOURNAL', name: 'Reject Journal Entries' },
    { code: 'JOURNAL_POST', module: 'JOURNAL', name: 'Post Journal Entries' },
    { code: 'JOURNAL_REVERSE', module: 'JOURNAL', name: 'Reverse Journal Entries' },
    { code: 'GENERAL_LEDGER_VIEW', module: 'LEDGER', name: 'View General Ledger' },
    { code: 'GENERAL_LEDGER_EXPORT', module: 'LEDGER', name: 'Export General Ledger' },
    { code: 'ACCOUNT_BALANCE_VIEW', module: 'ACCOUNTING', name: 'View Account Balances' },
    { code: 'DEPARTMENT_VIEW', module: 'DEPARTMENT', name: 'View Departments' },
    { code: 'DEPARTMENT_CREATE', module: 'DEPARTMENT', name: 'Create Departments' },
    { code: 'DEPARTMENT_UPDATE', module: 'DEPARTMENT', name: 'Update Departments' },
    { code: 'ACCOUNTING_CONFIGURATION_VIEW', module: 'ACCOUNTING', name: 'View Accounting Configuration' },
    { code: 'ACCOUNTING_CONFIGURATION_UPDATE', module: 'ACCOUNTING', name: 'Update Accounting Configuration' },
    { code: 'DEBTOR_VIEW', module: 'DEBTOR', name: 'View Debtors' },
    { code: 'DEBTOR_CREATE', module: 'DEBTOR', name: 'Create Debtors' },
    { code: 'DEBTOR_UPDATE', module: 'DEBTOR', name: 'Update Debtors' },
    { code: 'DEBTOR_DEACTIVATE', module: 'DEBTOR', name: 'Deactivate Debtors' },
    { code: 'DEBTOR_INVOICE_VIEW', module: 'DEBTOR', name: 'View Debtor Invoices' },
    { code: 'DEBTOR_INVOICE_CREATE', module: 'DEBTOR', name: 'Create Debtor Invoices' },
    { code: 'DEBTOR_INVOICE_UPDATE', module: 'DEBTOR', name: 'Update Debtor Invoices' },
    { code: 'DEBTOR_INVOICE_POST', module: 'DEBTOR', name: 'Post Debtor Invoices' },
    { code: 'DEBTOR_CREDIT_NOTE_VIEW', module: 'DEBTOR', name: 'View Debtor Credit Notes' },
    { code: 'DEBTOR_CREDIT_NOTE_CREATE', module: 'DEBTOR', name: 'Create Debtor Credit Notes' },
    { code: 'DEBTOR_CREDIT_NOTE_POST', module: 'DEBTOR', name: 'Post Debtor Credit Notes' },
    { code: 'RECEIPT_VIEW', module: 'DEBTOR', name: 'View Receipts' },
    { code: 'RECEIPT_CREATE', module: 'DEBTOR', name: 'Create Receipts' },
    { code: 'RECEIPT_POST', module: 'DEBTOR', name: 'Post Receipts' },
    { code: 'CREDITOR_VIEW', module: 'CREDITOR', name: 'View Creditors' },
    { code: 'CREDITOR_CREATE', module: 'CREDITOR', name: 'Create Creditors' },
    { code: 'CREDITOR_UPDATE', module: 'CREDITOR', name: 'Update Creditors' },
    { code: 'CREDITOR_DEACTIVATE', module: 'CREDITOR', name: 'Deactivate Creditors' },
    { code: 'CREDITOR_INVOICE_VIEW', module: 'CREDITOR', name: 'View Creditor Invoices' },
    { code: 'CREDITOR_INVOICE_CREATE', module: 'CREDITOR', name: 'Create Creditor Invoices' },
    { code: 'CREDITOR_INVOICE_UPDATE', module: 'CREDITOR', name: 'Update Creditor Invoices' },
    { code: 'CREDITOR_INVOICE_POST', module: 'CREDITOR', name: 'Post Creditor Invoices' },
    { code: 'CREDITOR_NOTE_VIEW', module: 'CREDITOR', name: 'View Creditor Notes' },
    { code: 'CREDITOR_NOTE_CREATE', module: 'CREDITOR', name: 'Create Creditor Notes' },
    { code: 'CREDITOR_NOTE_POST', module: 'CREDITOR', name: 'Post Creditor Notes' },
    { code: 'SUPPLIER_PAYMENT_VIEW', module: 'CREDITOR', name: 'View Supplier Payments' },
    { code: 'SUPPLIER_PAYMENT_CREATE', module: 'CREDITOR', name: 'Create Supplier Payments' },
    { code: 'SUPPLIER_PAYMENT_POST', module: 'CREDITOR', name: 'Post Supplier Payments' },
    { code: 'ALLOCATION_VIEW', module: 'ACCOUNTING', name: 'View Allocations' },
    { code: 'ALLOCATION_CREATE', module: 'ACCOUNTING', name: 'Create Allocations' },
    { code: 'ALLOCATION_REVERSE', module: 'ACCOUNTING', name: 'Reverse Allocations' },
    { code: 'DEBTOR_AGING_VIEW', module: 'DEBTOR', name: 'View Debtor Aging' },
    { code: 'CREDITOR_AGING_VIEW', module: 'CREDITOR', name: 'View Creditor Aging' },
    { code: 'DEBTOR_STATEMENT_VIEW', module: 'DEBTOR', name: 'View Debtor Statements' },
    { code: 'CREDITOR_STATEMENT_VIEW', module: 'CREDITOR', name: 'View Creditor Statements' },
    { code: 'FINANCIAL_YEAR_VIEW', module: 'FINANCIAL_YEAR', name: 'View Financial Years' },
    { code: 'FINANCIAL_YEAR_CREATE', module: 'FINANCIAL_YEAR', name: 'Create Financial Year' },
    { code: 'ACCOUNTING_PERIOD_VIEW', module: 'ACCOUNTING_PERIOD', name: 'View Accounting Periods' },
    { code: 'BANK_ACCOUNT_VIEW', module: 'BANKING', name: 'View Bank Accounts' },
    { code: 'BANK_ACCOUNT_CREATE', module: 'BANKING', name: 'Create Bank Accounts' },
    { code: 'BANK_ACCOUNT_UPDATE', module: 'BANKING', name: 'Update Bank Accounts' },
    { code: 'BANK_TRANSACTION_VIEW', module: 'BANKING', name: 'View Bank Transactions' },
    { code: 'BANK_TRANSACTION_CREATE', module: 'BANKING', name: 'Create Bank Transactions' },
    { code: 'BANK_TRANSACTION_APPROVE', module: 'BANKING', name: 'Approve Bank Transactions' },
    { code: 'PAYMENT_VOUCHER_VIEW', module: 'BANKING', name: 'View Payment Vouchers' },
    { code: 'PAYMENT_VOUCHER_CREATE', module: 'BANKING', name: 'Create Payment Vouchers' },
    { code: 'PAYMENT_VOUCHER_APPROVE', module: 'BANKING', name: 'Approve Payment Vouchers' },
    { code: 'CHEQUE_VIEW', module: 'BANKING', name: 'View Cheques' },
    { code: 'CHEQUE_CREATE', module: 'BANKING', name: 'Create Cheques' },
    { code: 'CHEQUE_UPDATE', module: 'BANKING', name: 'Update Cheques' },
    { code: 'RECONCILIATION_VIEW', module: 'BANKING', name: 'View Bank Reconciliations' },
    { code: 'RECONCILIATION_CREATE', module: 'BANKING', name: 'Create Bank Reconciliations' },
    { code: 'PMS_CONNECTION_VIEW', module: 'PMS', name: 'View PMS Connections' },
    { code: 'PMS_CONNECTION_MANAGE', module: 'PMS', name: 'Manage PMS Connections' },
    { code: 'PMS_MAPPING_VIEW', module: 'PMS', name: 'View PMS Mappings' },
    { code: 'PMS_MAPPING_MANAGE', module: 'PMS', name: 'Manage PMS Mappings' },
    { code: 'PMS_IMPORT_VIEW', module: 'PMS', name: 'View PMS Imports' },
    { code: 'PMS_IMPORT_CREATE', module: 'PMS', name: 'Create PMS Imports' },
    { code: 'PMS_IMPORT_APPROVE', module: 'PMS', name: 'Approve PMS Imports' },
    { code: 'PMS_IMPORT_POST', module: 'PMS', name: 'Post PMS Imports' },
    { code: 'PMS_RECONCILIATION_VIEW', module: 'PMS', name: 'View PMS Reconciliation' },
    { code: 'PMS_AUDIT_VIEW', module: 'PMS', name: 'View PMS Audit History' },
    { code: 'AUDIT_LOG_VIEW', module: 'AUDIT', name: 'View Audit Logs' },
    { code: 'SYSTEM_CONFIG_VIEW', module: 'SYSTEM', name: 'View System Configuration' },
    { code: 'SYSTEM_CONFIG_UPDATE', module: 'SYSTEM', name: 'Update System Configuration' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, module: perm.module },
      create: perm,
    });
  }

  const company = await prisma.company.upsert({
    where: { code: 'HQ' },
    update: {},
    create: {
      code: 'HQ',
      name: 'Hotel Finance HQ',
      currencyCode: 'USD',
    },
  });

  const branch = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: 'MAIN' } },
    update: {},
    create: { companyId: company.id, code: 'MAIN', name: 'Main Branch' },
  });

  const adminRole = await prisma.role.upsert({
    where: { code: 'SUPER_ADMIN' },
    update: {},
    create: {
      code: 'SUPER_ADMIN',
      name: 'Super Administrator',
      description: 'Full system access',
      isSystem: true,
    },
  });

  const accountantRole = await prisma.role.upsert({
    where: { code: 'ACCOUNTANT' },
    update: {},
    create: {
      code: 'ACCOUNTANT',
      name: 'Accountant',
      description: 'Standard accounting access',
      isSystem: true,
    },
  });

  const allPermissions = await prisma.permission.findMany();
  const adminRolePermissions = allPermissions.map((perm) => ({
    roleId: adminRole.id,
    permissionId: perm.id,
  }));
  const existingAdminRolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: adminRole.id },
    select: { permissionId: true },
  });
  const existingAdminPermissionIds = new Set(existingAdminRolePermissions.map((entry) => entry.permissionId));
  const missingAdminPermissions = adminRolePermissions.filter((entry) => !existingAdminPermissionIds.has(entry.permissionId));
  if (missingAdminPermissions.length > 0) {
    await prisma.rolePermission.createMany({
      data: missingAdminPermissions,
      skipDuplicates: true,
    });
  }

  const accountantPermCodes = [
    'DASHBOARD_VIEW',
    'USER_VIEW',
    'ROLE_VIEW',
    'COMPANY_VIEW',
    'COA_VIEW',
    'DEPARTMENT_VIEW',
    'JOURNAL_VIEW',
    'JOURNAL_CREATE',
    'JOURNAL_UPDATE',
    'JOURNAL_SUBMIT',
    'JOURNAL_APPROVE',
    'JOURNAL_POST',
    'GENERAL_LEDGER_VIEW',
    'ACCOUNT_BALANCE_VIEW',
    'FINANCIAL_YEAR_VIEW',
    'ACCOUNTING_PERIOD_VIEW',
  ];

  const accountantRolePermissions = allPermissions.filter((p) => accountantPermCodes.includes(p.code)).map((perm) => ({
    roleId: accountantRole.id,
    permissionId: perm.id,
  }));
  const existingAccountantRolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: accountantRole.id },
    select: { permissionId: true },
  });
  const existingAccountantPermissionIds = new Set(existingAccountantRolePermissions.map((entry) => entry.permissionId));
  const missingAccountantPermissions = accountantRolePermissions.filter((entry) => !existingAccountantPermissionIds.has(entry.permissionId));
  if (missingAccountantPermissions.length > 0) {
    await prisma.rolePermission.createMany({
      data: missingAccountantPermissions,
      skipDuplicates: true,
    });
  }

  const accountCategory = await prisma.accountCategory.upsert({
    where: { companyId_categoryCode: { companyId: company.id, categoryCode: 'ASSET' } },
    update: {},
    create: {
      companyId: company.id,
      categoryCode: 'ASSET',
      categoryName: 'Current Assets',
      accountNumberStart: 1000,
      accountNumberEnd: 1999,
      description: 'Default asset category',
      isActive: true,
    },
  });

  const accountType = await prisma.accountType.upsert({
    where: { companyId_typeCode: { companyId: company.id, typeCode: 'ASSET' } },
    update: {},
    create: {
      companyId: company.id,
      typeCode: 'ASSET',
      typeName: 'Asset',
      description: 'Default asset account type',
      isActive: true,
    },
  });

  await prisma.chartOfAccount.upsert({
    where: { companyId_accountCode: { companyId: company.id, accountCode: '1100' } },
    update: {},
    create: {
      companyId: company.id,
      branchId: branch.id,
      categoryId: accountCategory.id,
      accountTypeId: accountType.id,
      accountCode: '1100',
      accountName: 'Cash and Cash Equivalents',
      description: 'Default cash account for hotel operations',
      isActive: true,
      isSystemAccount: true,
    },
  });

  const department = await prisma.department.upsert({
    where: { companyId_departmentCode: { companyId: company.id, departmentCode: 'ROOMS' } },
    update: {},
    create: {
      companyId: company.id,
      departmentCode: 'ROOMS',
      departmentName: 'Rooms',
      description: 'Default room department',
      isActive: true,
    },
  });

  const adminPasswordHash = await hashPassword('123');
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      companyId: company.id,
      branchId: branch.id,
      email: 'admin@hotelfinance.com',
      passwordHash: adminPasswordHash,
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true,
    },
    create: {
      companyId: company.id,
      branchId: branch.id,
      username: 'admin',
      email: 'admin@hotelfinance.com',
      passwordHash: adminPasswordHash,
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: adminUser.id, roleId: adminRole.id },
    },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  const currentYear = new Date().getFullYear();
  const yearCode = `FY${currentYear}-${currentYear + 1}`;
  await prisma.financialYear.upsert({
    where: { companyId_yearCode: { companyId: company.id, yearCode } },
    update: {},
    create: {
      companyId: company.id,
      yearCode,
      startDate: new Date(`${currentYear}-01-01`),
      endDate: new Date(`${currentYear}-12-31`),
      status: 'OPEN',
      createdBy: adminUser.id,
    },
  });
}

async function main(): Promise<void> {
  console.log('🌱 Starting database seed...\n');
  await seedDefaultData();
  console.log('\n✅ Database seed completed successfully');
  console.log('─────────────────────────────────────');
  console.log('Login credentials:');
  console.log('  Username : admin');
  console.log('  Password : 123');
  console.log('─────────────────────────────────────');
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Seed failed:', e);
      process.exit(1);
    })
    .finally(() => void prisma.$disconnect());
}
