# Plataforma de Gestão Pedagógica
### Projeto Final — UC00604 (Programação Web - Frontend)

## 📝 Visão Geral
Este projeto nasce da necessidade de modernizar os processos administrativos em centros de formação, substituindo métodos obsoletos (como a entrega de documentação em CD) por uma **Plataforma Centralizada de Gestão Formativa**. A solução foca-se na eficiência logística, no rastreio (*tracking*) de conformidade e na segurança de dados sensíveis.

## 🚀 Funcionalidades Detalhadas

### 1. Painel de Controlo Inteligente (Dashboard)
* **Algoritmo de Prazos:** Implementação de lógica JavaScript que calcula automaticamente os dias restantes para a entrega de documentos com base na data atual.
* **Sistema de Semáforos (UX):** Atribuição dinâmica de estados visuais:
    * 🔴 **Crítico:** Documentos em falta com prazo ultrapassado.
    * 🟡 **Hoje:** Documentos com entrega no próprio dia.
    * 🔵 **Pendente:** Documentos dentro do prazo.
* **Filtros Rápidos:** Seletores que permitem isolar itens críticos ou pendentes, atualizando os contadores da interface em tempo real.

### 2. Gestão de Entidades (Turmas e Formadores)
* **Renderização Dinâmica:** As tabelas de turmas e formadores são geradas via JavaScript a partir de arrays de objetos, simulando o comportamento de uma futura API.
* **Contadores Automáticos:** Cálculo em tempo real do número de formadores ativos/inativos e turmas por estado.
* **Modais de Interação:** Interface para criação de novas turmas com validação de campos e estado inicial.

### 3. Experiência do Utilizador (UX/UI)
* **Navegação Persistente:** Sidebar ergonómica com feedback visual do estado ativo.
* **Feedback de Formulários:** Mensagens de erro personalizadas para campos obrigatórios e formatos de email institucionais (`@*.pt`).
* **Design Responsivo:** Adaptabilidade total para mobile através de Media Queries, transformando a navegação lateral em menu inferior para facilitar o uso em dispositivos táteis.

## 🛠️ Stack Tecnológica
* **HTML5:** Estrutura semântica utilizando as tags `aside`, `main`, `section` e `footer` para melhor acessibilidade.
* **CSS3:** Utilização de **CSS Variables** para gestão de cores, **Flexbox** para alinhamentos e **CSS Grid** para a estrutura do dashboard.
* **JavaScript (Vanilla):** Manipulação avançada do DOM, gestão de eventos e lógica de tratamento de datas.
* **Phosphor Icons:** Iconografia consistente para reforçar a semântica visual.


## 📁 Estrutura do Projeto
```text
/src
  /css
    style.css         # Arquitetura CSS (Reset, Layout, Componentes, Media Queries)
  /js
    script.js        # Motor da aplicação (Dados, Filtros, Prazos, Modais)
  /pages
    login.html       # Porta de entrada com validação de acesso
    forms.html       # Pedido de acesso com textarea e select dinâmico
    dashboardCoord.html # Interface principal com widget de agenda e tabelas
    turmas.html      # Área de gestão com modal de inserção
    formadores.html  # Listagem técnica de formadores e siglas (avatar)
    perfil.html      # Formulário de edição com campos "readonly" para segurança
```

---

# 🇬🇧 English Version

## 📝 Project Overview
This project was born from the need to modernize administrative processes in training centers, replacing obsolete methods (such as submitting documentation via physical CDs) with a **Centralized Pedagogical Management Platform**. The solution focuses on logistical efficiency, compliance tracking, and the security of sensitive data.

## 🚀 Key Features

### 1. Intelligent Control Panel (Dashboard)
* **Deadline Algorithm**: Implementation of JavaScript logic that automatically calculates the remaining days for document submission based on the current date.
* **Traffic Light System (UX)**: Dynamic assignment of visual states:
    * 🔴 **Critical**: Overdue documents.
    * 🟡 **Today**: Documents due on the current day.
    * 🔵 **Pending**: Documents within the deadline.
* **Quick Filters**: Selectors that allow isolating critical or pending items, updating interface counters in real-time.

### 2. Entity Management (Classes and Trainers)
* **Dynamic Rendering**: Data tables for classes and trainers are generated via JavaScript from object arrays, simulating future API behavior.
* **Automatic Counters**: Real-time calculation of active/inactive trainers and classes by status.
* **Interaction Modals**: Interface for creating new classes with field validation and initial status setting.

### 3. User Experience (UX/UI)
* **Persistent Navigation**: Ergonomic sidebar with visual feedback of the active state.
* **Form Feedback**: Personalized error messages for required fields and institutional email formats (`@*.pt`).
* **Responsive Design**: Full mobile adaptability through Media Queries, transforming the side navigation into a bottom menu for easier touch-screen use.

## 🛠️ Technology Stack
* **HTML5**: Semantic structure using `aside`, `main`, `section`, and `footer` tags for better accessibility.
* **CSS3**: Use of **CSS Variables** for color management, **Flexbox** for alignment, and **CSS Grid** for the dashboard layout.
* **JavaScript (Vanilla)**: Advanced DOM manipulation, event handling, and date processing logic.
* **Phosphor Icons**: Consistent iconography to reinforce visual semantics.

## 📁 Project Structure
```text
/src
  /css
    style.css         # CSS Architecture (Reset, Layout, Components, Media Queries)
  /js
    script.js        # Application Engine (Data, Filters, Deadlines, Modals)
  /pages
    login.html       # Entry point with access validation
    forms.html       # Access request form with dynamic selects
    dashboardCoord.html # Main interface with agenda widget and tables
    turmas.html      # Management area with insertion modals
    formadores.html  # Technical listing of trainers and avatars
    perfil.html      # Profile editing form with "readonly" fields for security
