-- CreateTable
CREATE TABLE `sumarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `aulaId` INTEGER NOT NULL,
    `texto` TEXT NOT NULL,
    `estado` ENUM('SUBMETIDO', 'VALIDADO', 'REJEITADO') NOT NULL DEFAULT 'SUBMETIDO',
    `escritoPorId` INTEGER NOT NULL,
    `validadoPorId` INTEGER NULL,
    `validadoEm` DATETIME(3) NULL,
    `notaValidacao` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sumarios_aulaId_key`(`aulaId`),
    INDEX `sumarios_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sumarios` ADD CONSTRAINT `sumarios_aulaId_fkey` FOREIGN KEY (`aulaId`) REFERENCES `aulas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sumarios` ADD CONSTRAINT `sumarios_escritoPorId_fkey` FOREIGN KEY (`escritoPorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sumarios` ADD CONSTRAINT `sumarios_validadoPorId_fkey` FOREIGN KEY (`validadoPorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
