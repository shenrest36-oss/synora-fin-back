-- CreateTable
CREATE TABLE `account_categories` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `categoryCode` VARCHAR(20) NOT NULL,
    `categoryName` VARCHAR(100) NOT NULL,
    `accountNumberStart` INTEGER NOT NULL,
    `accountNumberEnd` INTEGER NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `account_categories_companyId_idx`(`companyId`),
    UNIQUE INDEX `account_categories_companyId_categoryCode_key`(`companyId`, `categoryCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_subcategories` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `categoryId` CHAR(36) NOT NULL,
    `subcategoryCode` VARCHAR(20) NOT NULL,
    `subcategoryName` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `account_subcategories_categoryId_idx`(`categoryId`),
    UNIQUE INDEX `account_subcategories_categoryId_subcategoryCode_key`(`categoryId`, `subcategoryCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_types` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `typeCode` VARCHAR(20) NOT NULL,
    `typeName` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `account_types_companyId_idx`(`companyId`),
    UNIQUE INDEX `account_types_companyId_typeCode_key`(`companyId`, `typeCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chart_of_accounts` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `branchId` CHAR(36) NULL,
    `categoryId` CHAR(36) NOT NULL,
    `subcategoryId` CHAR(36) NULL,
    `accountTypeId` CHAR(36) NULL,
    `accountCode` VARCHAR(50) NOT NULL,
    `accountName` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isSystemAccount` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` CHAR(36) NULL,
    `updatedBy` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `chart_of_accounts_companyId_idx`(`companyId`),
    INDEX `chart_of_accounts_categoryId_idx`(`categoryId`),
    INDEX `chart_of_accounts_accountTypeId_idx`(`accountTypeId`),
    UNIQUE INDEX `chart_of_accounts_companyId_accountCode_key`(`companyId`, `accountCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `departmentCode` VARCHAR(20) NOT NULL,
    `departmentName` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `departments_companyId_idx`(`companyId`),
    UNIQUE INDEX `departments_companyId_departmentCode_key`(`companyId`, `departmentCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_departments` (
    `id` CHAR(36) NOT NULL,
    `departmentId` CHAR(36) NOT NULL,
    `subDepartmentCode` VARCHAR(20) NOT NULL,
    `subDepartmentName` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `sub_departments_departmentId_idx`(`departmentId`),
    UNIQUE INDEX `sub_departments_departmentId_subDepartmentCode_key`(`departmentId`, `subDepartmentCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_departments` (
    `id` CHAR(36) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `departmentId` CHAR(36) NOT NULL,
    `subDepartmentId` CHAR(36) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `account_departments_accountId_idx`(`accountId`),
    INDEX `account_departments_departmentId_idx`(`departmentId`),
    UNIQUE INDEX `account_departments_accountId_departmentId_subDepartmentId_key`(`accountId`, `departmentId`, `subDepartmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `account_categories` ADD CONSTRAINT `account_categories_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_subcategories` ADD CONSTRAINT `account_subcategories_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_subcategories` ADD CONSTRAINT `account_subcategories_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `account_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_types` ADD CONSTRAINT `account_types_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chart_of_accounts` ADD CONSTRAINT `chart_of_accounts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chart_of_accounts` ADD CONSTRAINT `chart_of_accounts_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chart_of_accounts` ADD CONSTRAINT `chart_of_accounts_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `account_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chart_of_accounts` ADD CONSTRAINT `chart_of_accounts_subcategoryId_fkey` FOREIGN KEY (`subcategoryId`) REFERENCES `account_subcategories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chart_of_accounts` ADD CONSTRAINT `chart_of_accounts_accountTypeId_fkey` FOREIGN KEY (`accountTypeId`) REFERENCES `account_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_departments` ADD CONSTRAINT `sub_departments_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_departments` ADD CONSTRAINT `account_departments_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `chart_of_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_departments` ADD CONSTRAINT `account_departments_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_departments` ADD CONSTRAINT `account_departments_subDepartmentId_fkey` FOREIGN KEY (`subDepartmentId`) REFERENCES `sub_departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
