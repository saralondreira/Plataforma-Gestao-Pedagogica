/*
  Warnings:

  - You are about to drop the column `ucId` on the `aulas` table. All the data in the column will be lost.
  - You are about to drop the column `formadorId` on the `ucs` table. All the data in the column will be lost.
  - You are about to drop the column `turmaId` on the `ucs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[abreviatura]` on the table `ucs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `turmaUcId` to the `aulas` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `aulas` DROP FOREIGN KEY `aulas_ucId_fkey`;

-- DropForeignKey
ALTER TABLE `ucs` DROP FOREIGN KEY `ucs_formadorId_fkey`;

-- DropForeignKey
ALTER TABLE `ucs` DROP FOREIGN KEY `ucs_turmaId_fkey`;

-- DropIndex
DROP INDEX `aulas_ucId_fkey` ON `aulas`;

-- DropIndex
DROP INDEX `ucs_formadorId_fkey` ON `ucs`;

-- DropIndex
DROP INDEX `ucs_turmaId_abreviatura_key` ON `ucs`;

-- AlterTable
ALTER TABLE `aulas` DROP COLUMN `ucId`,
    ADD COLUMN `turmaUcId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `ucs` DROP COLUMN `formadorId`,
    DROP COLUMN `turmaId`;

-- CreateTable
CREATE TABLE `turma_ucs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `turmaId` INTEGER NOT NULL,
    `ucId` INTEGER NOT NULL,
    `formadorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `turma_ucs_turmaId_ucId_key`(`turmaId`, `ucId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `ucs_abreviatura_key` ON `ucs`(`abreviatura`);

-- AddForeignKey
ALTER TABLE `turma_ucs` ADD CONSTRAINT `turma_ucs_turmaId_fkey` FOREIGN KEY (`turmaId`) REFERENCES `turmas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turma_ucs` ADD CONSTRAINT `turma_ucs_ucId_fkey` FOREIGN KEY (`ucId`) REFERENCES `ucs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turma_ucs` ADD CONSTRAINT `turma_ucs_formadorId_fkey` FOREIGN KEY (`formadorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aulas` ADD CONSTRAINT `aulas_turmaUcId_fkey` FOREIGN KEY (`turmaUcId`) REFERENCES `turma_ucs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
