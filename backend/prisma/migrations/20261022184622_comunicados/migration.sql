-- CreateTable
CREATE TABLE `comunicados` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `turmaId` INTEGER NOT NULL,
    `autorId` INTEGER NOT NULL,
    `assunto` VARCHAR(191) NOT NULL,
    `corpo` TEXT NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `comunicados_turmaId_ativo_idx`(`turmaId`, `ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `comunicados` ADD CONSTRAINT `comunicados_turmaId_fkey` FOREIGN KEY (`turmaId`) REFERENCES `turmas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comunicados` ADD CONSTRAINT `comunicados_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
