-- CreateTable
CREATE TABLE `notas_historico` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `turmaUcId` INTEGER NOT NULL,
    `formandoId` INTEGER NOT NULL,
    `valorAnterior` DOUBLE NULL,
    `valorNovo` DOUBLE NOT NULL,
    `observacoesAnteriores` TEXT NULL,
    `observacoesNovas` TEXT NULL,
    `alteradaPorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notas_historico_turmaUcId_formandoId_idx`(`turmaUcId`, `formandoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notas_historico` ADD CONSTRAINT `notas_historico_turmaUcId_fkey` FOREIGN KEY (`turmaUcId`) REFERENCES `turma_ucs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notas_historico` ADD CONSTRAINT `notas_historico_formandoId_fkey` FOREIGN KEY (`formandoId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notas_historico` ADD CONSTRAINT `notas_historico_alteradaPorId_fkey` FOREIGN KEY (`alteradaPorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
