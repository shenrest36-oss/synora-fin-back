-- CreateTable
CREATE TABLE `pms_connections` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `connectionType` VARCHAR(30) NOT NULL,
    `host` VARCHAR(255) NULL,
    `port` INTEGER NULL,
    `databaseName` VARCHAR(120) NULL,
    `username` VARCHAR(120) NULL,
    `passwordHash` VARCHAR(255) NULL,
    `apiBaseUrl` VARCHAR(255) NULL,
    `apiKeyHash` VARCHAR(255) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `syncEnabled` BOOLEAN NOT NULL DEFAULT false,
    `connectionStatus` VARCHAR(30) NOT NULL DEFAULT 'DISCONNECTED',
    `businessDateMode` VARCHAR(30) NOT NULL DEFAULT 'LOCAL',
    `sourceSystemIdentifier` VARCHAR(100) NULL,
    `lastTestedAt` DATETIME(3) NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdBy` CHAR(36) NULL,
    `updatedBy` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pms_connections_companyId_name_key`(`companyId`, `name`),
    INDEX `pms_connections_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pms_account_mappings` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `sourceType` VARCHAR(50) NOT NULL,
    `sourceCode` VARCHAR(80) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `departmentId` CHAR(36) NULL,
    `taxAccountId` CHAR(36) NULL,
    `serviceChargeAccountId` CHAR(36) NULL,
    `advanceAccountId` CHAR(36) NULL,
    `debtorControlAccountId` CHAR(36) NULL,
    `bankAccountId` CHAR(36) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `effectiveFrom` DATE NULL,
    `effectiveTo` DATE NULL,
    `notes` TEXT NULL,
    `createdBy` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pms_account_mapping_company_source_key`(`companyId`, `sourceType`, `sourceCode`),
    INDEX `pms_account_mapping_company_type_idx`(`companyId`, `sourceType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pms_department_mappings` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `sourceDepartmentCode` VARCHAR(50) NOT NULL,
    `departmentId` CHAR(36) NOT NULL,
    `subDepartmentId` CHAR(36) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdBy` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pms_department_mapping_company_code_key`(`companyId`, `sourceDepartmentCode`),
    INDEX `pms_department_mapping_company_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pms_import_batches` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `connectionId` CHAR(36) NOT NULL,
    `batchNumber` VARCHAR(80) NOT NULL,
    `sourceSystem` VARCHAR(50) NOT NULL,
    `businessDateStart` DATE NULL,
    `businessDateEnd` DATE NULL,
    `totalRecords` INTEGER NOT NULL DEFAULT 0,
    `importedRecords` INTEGER NOT NULL DEFAULT 0,
    `failedRecords` INTEGER NOT NULL DEFAULT 0,
    `duplicateRecords` INTEGER NOT NULL DEFAULT 0,
    `totalDebit` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `totalCredit` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `status` VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    `createdBy` CHAR(36) NULL,
    `approvedBy` CHAR(36) NULL,
    `postedBy` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `approvedAt` DATETIME(3) NULL,
    `postedAt` DATETIME(3) NULL,

    UNIQUE INDEX `pms_import_batches_companyId_batchNumber_key`(`companyId`, `batchNumber`),
    INDEX `pms_import_batches_companyId_status_idx`(`companyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pms_import_transactions` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `batchId` CHAR(36) NOT NULL,
    `connectionId` CHAR(36) NULL,
    `sourceTransactionId` VARCHAR(100) NOT NULL,
    `sourceType` VARCHAR(50) NOT NULL,
    `businessDate` DATE NOT NULL,
    `transactionDate` DATETIME(0) NULL,
    `guestReference` VARCHAR(120) NULL,
    `department` VARCHAR(100) NULL,
    `currencyCode` VARCHAR(10) NOT NULL DEFAULT 'USD',
    `grossAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `serviceCharge` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `discount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `netAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `validationStatus` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `importStatus` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `validationErrors` JSON NULL,
    `rawPayload` JSON NULL,
    `mappedAccountId` CHAR(36) NULL,
    `mappedDepartmentId` CHAR(36) NULL,
    `journalEntryId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pms_import_tx_company_source_key`(`companyId`, `sourceTransactionId`, `sourceType`),
    INDEX `pms_import_tx_batch_idx`(`batchId`),
    INDEX `pms_import_tx_company_status_idx`(`companyId`, `validationStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pms_reconciliations` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `batchId` CHAR(36) NULL,
    `pmsConnectionId` CHAR(36) NULL,
    `businessDate` DATE NOT NULL,
    `pmsTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `importedTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `postedTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `difference` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `status` VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    `notes` TEXT NULL,
    `createdBy` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `pms_reconciliations_companyId_businessDate_idx`(`companyId`, `businessDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pms_connections` ADD CONSTRAINT `pms_connections_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pms_account_mappings` ADD CONSTRAINT `pms_account_mappings_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pms_account_mappings` ADD CONSTRAINT `pms_account_mappings_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pms_account_mappings` ADD CONSTRAINT `pms_account_mappings_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pms_department_mappings` ADD CONSTRAINT `pms_department_mappings_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pms_department_mappings` ADD CONSTRAINT `pms_department_mappings_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pms_import_batches` ADD CONSTRAINT `pms_import_batches_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pms_import_batches` ADD CONSTRAINT `pms_import_batches_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `pms_connections`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pms_import_transactions` ADD CONSTRAINT `pms_import_transactions_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pms_import_transactions` ADD CONSTRAINT `pms_import_transactions_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `pms_import_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pms_reconciliations` ADD CONSTRAINT `pms_reconciliations_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
