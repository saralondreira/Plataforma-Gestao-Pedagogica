// Menu lateral por papel. `base` são as páginas que já existiam (só usadas
// nas páginas novas, que montam o menu inteiro: <nav data-auto>); `extras` são
// as páginas das funcionalidades de formando/formador (notas, assiduidade,
// trabalhos, mensagens) — o guard.js acrescenta-as a TODAS as páginas internas,
// por isso não é preciso editar o menu de cada página à mão.
export const ROTULO_ROLE = {
  COORDENADOR: "Coordenação",
  FORMADOR: "Formador(a)",
  FORMANDO: "Formando(a)",
};

export const PAGINA_INICIAL = {
  COORDENADOR: "dashboardCoord.html",
  FORMADOR: "dashboardFormador.html",
  FORMANDO: "dashboardFormando.html",
};

export const MENU = {
  COORDENADOR: {
    base: [
      { href: "dashboardCoord.html", icon: "ph-chart-pie-slice", label: "Visão Global" },
      { href: "turmas.html", icon: "ph-chalkboard-teacher", label: "Gestão Turmas" },
      { href: "formadores.html", icon: "ph-users-three", label: "Gestão Formadores" },
      { href: "formandos.html", icon: "ph-graduation-cap", label: "Gestão Formandos" },
      { href: "agenda.html", icon: "ph-calendar-check", label: "Agenda" },
      { href: "pedidosAcesso.html", icon: "ph-user-plus", label: "Pedidos de Acesso" },
    ],
    extras: [
      { href: "conformidade.html", icon: "ph-traffic-signal", label: "Conformidade" },
      { href: "pesquisa.html", icon: "ph-magnifying-glass", label: "Pesquisa" },
      { href: "horarioGeral.html", icon: "ph-calendar-dots", label: "Horário Geral" },
      { href: "sumarios.html", icon: "ph-notebook", label: "Sumários" },
      { href: "comunicados.html", icon: "ph-megaphone", label: "Comunicados" },
      { href: "documentos.html", icon: "ph-folder-open", label: "Documentos" },
      { href: "pautas.html", icon: "ph-table", label: "Pautas e Assiduidade" },
      { href: "relatorioHoras.html", icon: "ph-clock", label: "Horas por Formador" },
      { href: "assiduidade.html", icon: "ph-user-check", label: "Justificações" },
      { href: "mensagens.html", icon: "ph-chat-circle-text", label: "Mensagens" },
    ],
  },
  FORMADOR: {
    base: [
      { href: "dashboardFormador.html", icon: "ph-clipboard-text", label: "Os Meus Documentos" },
      { href: "agendaFormador.html", icon: "ph-calendar-check", label: "A Minha Agenda" },
    ],
    extras: [
      { href: "horario.html", icon: "ph-calendar-blank", label: "O Meu Horário" },
      { href: "conformidade.html", icon: "ph-traffic-signal", label: "Conformidade" },
      { href: "sumarios.html", icon: "ph-notebook", label: "Sumários" },
      { href: "comunicados.html", icon: "ph-megaphone", label: "Comunicados" },
      { href: "documentos.html", icon: "ph-folder-open", label: "Documentos" },
      { href: "mediacao.html", icon: "ph-users-three", label: "Mediação" },
      { href: "notas.html", icon: "ph-medal", label: "Notas" },
      { href: "assiduidade.html", icon: "ph-user-check", label: "Assiduidade" },
      { href: "trabalhos.html", icon: "ph-notebook", label: "Trabalhos" },
      { href: "mensagens.html", icon: "ph-chat-circle-text", label: "Mensagens" },
    ],
  },
  FORMANDO: {
    base: [{ href: "dashboardFormando.html", icon: "ph-chalkboard-teacher", label: "A Minha Turma" }],
    extras: [
      { href: "horario.html", icon: "ph-calendar-blank", label: "O Meu Horário" },
      { href: "sumarios.html", icon: "ph-notebook", label: "Sumários" },
      { href: "comunicados.html", icon: "ph-megaphone", label: "Comunicados" },
      { href: "documentos.html", icon: "ph-folder-open", label: "Documentos" },
      { href: "notas.html", icon: "ph-medal", label: "As Minhas Notas" },
      { href: "assiduidade.html", icon: "ph-user-check", label: "Assiduidade" },
      { href: "trabalhos.html", icon: "ph-notebook", label: "Trabalhos" },
      { href: "mensagens.html", icon: "ph-chat-circle-text", label: "Mensagens" },
    ],
  },
};
