-- AlterTable
ALTER TABLE `turmas` ADD COLUMN `idCursoIEFP` VARCHAR(191) NULL,
    ADD COLUMN `mediadorId` INTEGER NULL;

-- CreateTable
CREATE TABLE `ucs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `turmaId` INTEGER NOT NULL,
    `abreviatura` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `cargaHoraria` INTEGER NOT NULL,
    `formadorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ucs_turmaId_abreviatura_key`(`turmaId`, `abreviatura`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `disponibilidades` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `formadorId` INTEGER NOT NULL,
    `data` DATE NOT NULL,
    `horaInicio` INTEGER NOT NULL,
    `estado` ENUM('LIVRE', 'BLOQUEADO') NOT NULL DEFAULT 'LIVRE',
    `motivo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `disponibilidades_formadorId_data_horaInicio_key`(`formadorId`, `data`, `horaInicio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `aulas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ucId` INTEGER NOT NULL,
    `disponibilidadeId` INTEGER NOT NULL,
    `data` DATE NOT NULL,
    `horaInicio` INTEGER NOT NULL,
    `duracaoHoras` INTEGER NOT NULL DEFAULT 1,
    `modalidade` ENUM('PRESENCIAL', 'ONLINE') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `aulas_disponibilidadeId_key`(`disponibilidadeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `turmas` ADD CONSTRAINT `turmas_mediadorId_fkey` FOREIGN KEY (`mediadorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ucs` ADD CONSTRAINT `ucs_turmaId_fkey` FOREIGN KEY (`turmaId`) REFERENCES `turmas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ucs` ADD CONSTRAINT `ucs_formadorId_fkey` FOREIGN KEY (`formadorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `disponibilidades` ADD CONSTRAINT `disponibilidades_formadorId_fkey` FOREIGN KEY (`formadorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aulas` ADD CONSTRAINT `aulas_ucId_fkey` FOREIGN KEY (`ucId`) REFERENCES `ucs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aulas` ADD CONSTRAINT `aulas_disponibilidadeId_fkey` FOREIGN KEY (`disponibilidadeId`) REFERENCES `disponibilidades`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
