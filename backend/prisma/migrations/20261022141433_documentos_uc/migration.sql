-- CreateTable
CREATE TABLE `documentos_uc` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `turmaUcId` INTEGER NOT NULL,
    `categoria` ENUM('MATERIAL', 'PLANO', 'AVALIACAO', 'OUTRO') NOT NULL DEFAULT 'MATERIAL',
    `nomePadrao` VARCHAR(191) NOT NULL,
    `nomeOriginal` VARCHAR(191) NOT NULL,
    `ficheiro` VARCHAR(191) NOT NULL,
    `tamanho` INTEGER NOT NULL,
    `enviadoPorId` INTEGER NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `removidoEm` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `documentos_uc_turmaUcId_ativo_idx`(`turmaUcId`, `ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `documentos_uc` ADD CONSTRAINT `documentos_uc_turmaUcId_fkey` FOREIGN KEY (`turmaUcId`) REFERENCES `turma_ucs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_uc` ADD CONSTRAINT `documentos_uc_enviadoPorId_fkey` FOREIGN KEY (`enviadoPorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
