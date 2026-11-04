import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import usersRoutes from '../modules/users/users.routes';
import rolesRoutes from '../modules/roles/roles.routes';
import permissionsRoutes from '../modules/permissions/permissions.routes';
import accountCategoriesRoutes from '../modules/account-categories/account-categories';
import accountSubcategoriesRoutes from '../modules/account-subcategories/account-subcategories';
import accountTypesRoutes from '../modules/account-types/account-types';
import chartOfAccountsRoutes from '../modules/chart-of-accounts/chart-of-accounts';
import departmentsRoutes from '../modules/departments/departments';
import journalEntriesRoutes from '../modules/journal-entries/journal-entries';
import generalLedgerRoutes from '../modules/general-ledger/general-ledger';
import accountBalancesRoutes from '../modules/account-balances/account-balances';
import debtorsRoutes from '../modules/debtors/debtors';
import creditorsRoutes from '../modules/creditors/creditors';
import debtorInvoicesRoutes from '../modules/debtor-invoices/debtor-invoices';
import creditorInvoicesRoutes from '../modules/creditor-invoices/creditor-invoices';
import debtorCreditNotesRoutes from '../modules/debtor-credit-notes/debtor-credit-notes';
import creditorNotesRoutes from '../modules/creditor-notes/creditor-notes';
import receiptsRoutes from '../modules/receipts/receipts';
import supplierPaymentsRoutes from '../modules/supplier-payments/supplier-payments';
import allocationsRoutes from '../modules/allocations/allocations';
import bankAccountsRoutes from '../modules/bank-accounts/bank-accounts';
import bankTransactionsRoutes from '../modules/bank-transactions/bank-transactions';
import paymentVouchersRoutes from '../modules/payment-vouchers/payment-vouchers';
import chequesRoutes from '../modules/cheques/cheques';
import bankReconciliationsRoutes from '../modules/bank-reconciliations/bank-reconciliations';
import pmsConnectionsRoutes from '../modules/pms-connections/pms-connections';
import pmsMappingsRoutes from '../modules/pms-mappings/pms-mappings';
import pmsImportsRoutes from '../modules/pms-imports/pms-imports';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env['NODE_ENV'],
    },
  });
});

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/roles', rolesRoutes);
router.use('/permissions', permissionsRoutes);
router.use('/account-categories', accountCategoriesRoutes);
router.use('/account-subcategories', accountSubcategoriesRoutes);
router.use('/account-types', accountTypesRoutes);
router.use('/chart-of-accounts', chartOfAccountsRoutes);
router.use('/departments', departmentsRoutes);
router.use('/journal-entries', journalEntriesRoutes);
router.use('/general-ledger', generalLedgerRoutes);
router.use('/account-balances', accountBalancesRoutes);
router.use('/debtors', debtorsRoutes);
router.use('/creditors', creditorsRoutes);
router.use('/debtor-invoices', debtorInvoicesRoutes);
router.use('/creditor-invoices', creditorInvoicesRoutes);
router.use('/debtor-credit-notes', debtorCreditNotesRoutes);
router.use('/creditor-notes', creditorNotesRoutes);
router.use('/receipts', receiptsRoutes);
router.use('/supplier-payments', supplierPaymentsRoutes);
router.use('/allocations', allocationsRoutes);
router.use('/bank-accounts', bankAccountsRoutes);
router.use('/bank-transactions', bankTransactionsRoutes);
router.use('/payment-vouchers', paymentVouchersRoutes);
router.use('/cheques', chequesRoutes);
router.use('/bank-reconciliations', bankReconciliationsRoutes);
router.use('/pms-connections', pmsConnectionsRoutes);
router.use('/pms-mappings', pmsMappingsRoutes);
router.use('/pms-imports', pmsImportsRoutes);

export default router;
