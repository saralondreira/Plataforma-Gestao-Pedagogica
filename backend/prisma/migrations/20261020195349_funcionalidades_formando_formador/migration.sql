-- AlterTable
ALTER TABLE `pedidos_acesso` ADD COLUMN `roleDecidido` ENUM('COORDENADOR', 'FORMADOR', 'FORMANDO') NULL,
    ADD COLUMN `turmaIdDecidido` INTEGER NULL,
    MODIFY `estado` ENUM('PENDENTE', 'A_AGUARDAR_RH', 'APROVADO', 'REJEITADO') NOT NULL DEFAULT 'PENDENTE';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `turmaId` INTEGER NULL;

-- CreateTable
CREATE TABLE `notas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `turmaUcId` INTEGER NOT NULL,
    `formandoId` INTEGER NOT NULL,
    `valor` DOUBLE NOT NULL,
    `observacoes` TEXT NULL,
    `lancadaPorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notas_turmaUcId_formandoId_key`(`turmaUcId`, `formandoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `presencas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `aulaId` INTEGER NOT NULL,
    `formandoId` INTEGER NOT NULL,
    `estado` ENUM('PRESENTE', 'AUSENTE') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `presencas_aulaId_formandoId_key`(`aulaId`, `formandoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `justificacoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `aulaId` INTEGER NOT NULL,
    `formandoId` INTEGER NOT NULL,
    `motivo` TEXT NOT NULL,
    `anexoUrl` VARCHAR(191) NULL,
    `estado` ENUM('PENDENTE', 'ACEITE', 'REJEITADA') NOT NULL DEFAULT 'PENDENTE',
    `decididaPorId` INTEGER NULL,
    `decididaEm` DATETIME(3) NULL,
    `notaDecisao` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `justificacoes_aulaId_formandoId_key`(`aulaId`, `formandoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trabalhos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `turmaUcId` INTEGER NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NOT NULL,
    `dataLimite` DATETIME(3) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoPorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submissoes_trabalho` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `trabalhoId` INTEGER NOT NULL,
    `formandoId` INTEGER NOT NULL,
    `ficheiroUrl` VARCHAR(191) NOT NULL,
    `comentario` TEXT NULL,
    `avaliacao` DOUBLE NULL,
    `feedback` TEXT NULL,
    `enviadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `submissoes_trabalho_trabalhoId_formandoId_key`(`trabalhoId`, `formandoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mensagens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `remetenteId` INTEGER NOT NULL,
    `destino` ENUM('COORDENACAO', 'FORMADOR', 'ASSISTENTE_SOCIAL') NOT NULL,
    `destinatarioId` INTEGER NULL,
    `assunto` VARCHAR(191) NOT NULL,
    `corpo` TEXT NOT NULL,
    `lida` BOOLEAN NOT NULL DEFAULT false,
    `resposta` TEXT NULL,
    `respondidaEm` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_turmaId_fkey` FOREIGN KEY (`turmaId`) REFERENCES `turmas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedidos_acesso` ADD CONSTRAINT `pedidos_acesso_turmaIdDecidido_fkey` FOREIGN KEY (`turmaIdDecidido`) REFERENCES `turmas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notas` ADD CONSTRAINT `notas_turmaUcId_fkey` FOREIGN KEY (`turmaUcId`) REFERENCES `turma_ucs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notas` ADD CONSTRAINT `notas_formandoId_fkey` FOREIGN KEY (`formandoId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notas` ADD CONSTRAINT `notas_lancadaPorId_fkey` FOREIGN KEY (`lancadaPorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `presencas` ADD CONSTRAINT `presencas_aulaId_fkey` FOREIGN KEY (`aulaId`) REFERENCES `aulas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `presencas` ADD CONSTRAINT `presencas_formandoId_fkey` FOREIGN KEY (`formandoId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `justificacoes` ADD CONSTRAINT `justificacoes_aulaId_fkey` FOREIGN KEY (`aulaId`) REFERENCES `aulas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `justificacoes` ADD CONSTRAINT `justificacoes_formandoId_fkey` FOREIGN KEY (`formandoId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `justificacoes` ADD CONSTRAINT `justificacoes_decididaPorId_fkey` FOREIGN KEY (`decididaPorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trabalhos` ADD CONSTRAINT `trabalhos_turmaUcId_fkey` FOREIGN KEY (`turmaUcId`) REFERENCES `turma_ucs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trabalhos` ADD CONSTRAINT `trabalhos_criadoPorId_fkey` FOREIGN KEY (`criadoPorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissoes_trabalho` ADD CONSTRAINT `submissoes_trabalho_trabalhoId_fkey` FOREIGN KEY (`trabalhoId`) REFERENCES `trabalhos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissoes_trabalho` ADD CONSTRAINT `submissoes_trabalho_formandoId_fkey` FOREIGN KEY (`formandoId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensagens` ADD CONSTRAINT `mensagens_remetenteId_fkey` FOREIGN KEY (`remetenteId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensagens` ADD CONSTRAINT `mensagens_destinatarioId_fkey` FOREIGN KEY (`destinatarioId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
