-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('COORDENADOR', 'FORMADOR') NOT NULL,
    `contacto` VARCHAR(191) NULL,
    `linkedin` VARCHAR(191) NULL,
    `competencias` TEXT NULL,
    `sigla` VARCHAR(191) NULL,
    `turmasQtd` INTEGER NULL,
    `ucsQtd` INTEGER NULL,
    `estadoFormador` ENUM('ATIVO', 'INATIVO') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `turmas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `designacao` VARCHAR(191) NOT NULL,
    `dataInicio` DATETIME(3) NOT NULL,
    `numFormandos` INTEGER NOT NULL DEFAULT 20,
    `estado` ENUM('PLANEADA', 'EM_CURSO', 'CONCLUIDA') NOT NULL DEFAULT 'PLANEADA',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `turmas_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entregas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `formadorId` INTEGER NOT NULL,
    `turmaId` INTEGER NOT NULL,
    `documento` VARCHAR(191) NOT NULL,
    `dataLimite` DATETIME(3) NOT NULL,
    `entregue` BOOLEAN NOT NULL DEFAULT false,
    `submissaoTipo` ENUM('FICHEIRO', 'EXCECAO', 'COORDENACAO') NULL,
    `submissaoFicheiroUrl` VARCHAR(191) NULL,
    `submissaoNota` TEXT NULL,
    `submissaoData` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pedidos_acesso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `cargo` VARCHAR(191) NOT NULL,
    `motivo` TEXT NOT NULL,
    `estado` ENUM('PENDENTE', 'APROVADO', 'REJEITADO') NOT NULL DEFAULT 'PENDENTE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `entregas` ADD CONSTRAINT `entregas_formadorId_fkey` FOREIGN KEY (`formadorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entregas` ADD CONSTRAINT `entregas_turmaId_fkey` FOREIGN KEY (`turmaId`) REFERENCES `turmas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
