import { jsPDF } from 'jspdf';

export const generateUserGuidePDF = () => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomLimit = pageHeight - 20;
  let y = 20;

  // Header background banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('DriveSync Turbo', 15, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Guia Oficial de Funcionalidades, Ilustrações Funcionais e Atualizações', 15, 29);

  y = 52;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > bottomLimit) {
      doc.addPage();
      y = 20;
    }
  };

  const addSection = (title: string) => {
    ensureSpace(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, 15, y);
    doc.setDrawColor(203, 213, 225);
    doc.line(15, y + 2, pageWidth - 15, y + 2);
    y += 9;
  };

  const addParagraph = (text: string) => {
    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const splitText = doc.splitTextToSize(text, pageWidth - 30);
    const height = splitText.length * 5.2 + 4;
    ensureSpace(height);
    doc.text(splitText, 15, y, { lineHeightFactor: 1.35 });
    y += height;
  };

  const addBullet = (boldTitle: string, description: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const descLines = doc.splitTextToSize(description, pageWidth - 34);
    const neededHeight = 5.5 + descLines.length * 5.0 + 4;
    ensureSpace(neededHeight);

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`• ${boldTitle}`, 15, y);
    y += 5;

    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(descLines, 19, y, { lineHeightFactor: 1.35 });
    y += descLines.length * 5.0 + 4;
  };

  // Helper to draw clean illustrative UI mockups for functional screens
  const drawUiMockupBox = (title: string, drawContent: (startY: number) => number) => {
    ensureSpace(42);
    const boxX = 15;
    const boxY = y;
    const boxW = pageWidth - 30;
    const boxH = 38;

    // Outer card background
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, 'FD');

    // Title bar
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(boxX, boxY, boxW, 8, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`[Ilustração Funcional] ${title}`, boxX + 4, boxY + 5.5);

    y = boxY + 11;
    drawContent(y);
    y = boxY + boxH + 6;
  };

  // 1. Introdução
  addSection('1. Introdução ao DriveSync Turbo');
  addParagraph(
    'O DriveSync Turbo é uma ferramenta de alta performance para baixar, compactar e sincronizar arquivos e pastas do Google Drive diretamente para o seu computador, com conexões paralelas, acompanhamento visual em tempo real e preservação integral da estrutura de diretórios.'
  );

  // UI Illustration 1: Header / Connection Screen
  drawUiMockupBox('Tela Inicial & Conexão Google Drive', (startY) => {
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(20, startY, pageWidth - 40, 24, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DriveSync Turbo', 25, startY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('6x Threads • Sincronização em tempo real & downloads ultrarrápidos', 25, startY + 12);

    // Badge Drive Conectado
    doc.setFillColor(6, 78, 59);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(pageWidth - 75, startY + 5, 52, 10, 2, 2, 'FD');
    doc.setTextColor(110, 231, 183);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('✓ Drive Conectado', pageWidth - 71, startY + 11.5);
    return startY + 24;
  });

  // 2. Vantagens em relação ao Google Drive Web
  addSection('2. Ganhos em Relação ao Download Direto pelo Google Drive');
  addBullet(
    'Gravação direta na pasta sem compactação obrigatória (Iniciar o Download)',
    'Na interface web do Google Drive, baixar pastas ou vários arquivos força a criação de múltiplos pacotes .ZIP que exigem extração manual. No DriveSync Turbo (executado em nova aba com pasta vinculada ou no modo desktop), as pastas e os arquivos originais são gravados diretamente no disco sem compactação.'
  );
  addBullet(
    'Mais velocidade com conexões paralelas e divisão Multi-Chunk',
    'Permite configurar de 2x até 16x downloads simultâneos e dividir arquivos grandes (acima de 25 MB) em múltiplos canais paralelos via HTTP Range, oferecendo telemetria de rede ao vivo, pausa e retomada.'
  );
  addBullet(
    'Backup completo com memória para continuar de onde parou (Baixar Tudo)',
    'Ao contrário do Google Drive web - onde cancelar ou interromper o download faz perder todo o trabalho -, a função Baixar Tudo salva o progresso localmente em memória persistente para retomar exatamente de onde parou.'
  );
  addBullet(
    'Proteção automática contra arquivos com nomes repetidos',
    'O Google Drive permite vários arquivos com o mesmo nome dentro da mesma pasta. Tanto na gravação direta no disco quanto nos arquivos .ZIP, o aplicativo renomeia duplicatas automaticamente (ex.: documento (1).pdf) para evitar sobrescrita ou perda de dados.'
  );
  addBullet(
    'Sincronização automática em tempo real (AutoSync)',
    'Monitora pastas e arquivos escolhidos em intervalos configuráveis (5s a 60s) e baixa automaticamente qualquer arquivo novo ou modificado sem exigir downloads manuais repetidos.'
  );

  // UI Illustration 2: Comparative Google Drive Web vs DriveSync Turbo
  drawUiMockupBox('Comparativo: Google Drive Web vs DriveSync Turbo', (startY) => {
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(20, startY, pageWidth - 40, 24, 2, 2, 'F');

    doc.setTextColor(244, 63, 94); // rose
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Google Drive Web:', 25, startY + 6);
    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'normal');
    doc.text('Lento, .ZIP obrigatório, sem retomada após queda de conexão.', 55, startY + 6);

    doc.setTextColor(16, 185, 129); // emerald
    doc.setFont('helvetica', 'bold');
    doc.text('DriveSync Turbo:', 25, startY + 15);
    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'normal');
    doc.text('16x mais rápido, pastas originais sem ZIP, memória e AutoSync.', 55, startY + 15);

    return startY + 24;
  });

  // 3. Funcionalidades e Atualizações Implementadas
  addSection('3. Principais Funcionalidades e Melhorias Recentes');
  addBullet(
    'Iniciar o Download com criação de pastas originais (Sem ZIP)',
    'Ao utilizar "Iniciar o Download", o aplicativo cria no destino as pastas com os mesmos nomes originais do Drive e baixa os arquivos diretamente sem compactá-los em .ZIP. Em navegadores dentro de iframe com restrição de acesso ao disco, o sistema orienta abrir em nova aba para habilitar a gravação nativa de pastas.'
  );
  addBullet(
    'Indicador circular giratório e tela de acompanhamento',
    'Durante os downloads em andamento, um indicador circular giratório central exibe o percentual concluído, velocidade instantânea, arquivo atual, volume transferido e botão imediato de parada.'
  );
  addBullet(
    'Tela final de estatísticas e link para a pasta destino',
    'Ao concluir o download ou geração do .ZIP, é exibido um resumo completo com quantidade de arquivos, pastas processadas, erros (se houver), volume total, tempo decorrido, velocidade média/pico e acesso direto para inspecionar ou abrir a pasta de destino.'
  );
  addBullet(
    'Função "Baixar Tudo" com permissão, acompanhamento e memória persistente',
    'Solicita autorização antes de compactar todo o Google Drive em .ZIP e abre uma tela de acompanhamento em tempo real com botão "Cancelar" imediato. Após um cancelamento, o progresso fica salvo na memória; ao acionar "Baixar Tudo" novamente, o app pede autorização para continuar de onde parou ou, se negada, limpa a memória e recomeça tudo do zero.'
  );
  addBullet(
    'Função "Baixar ZIP" com janela de progresso e hierarquia fiel do Drive',
    'Ao selecionar arquivos ou subpastas e clicar em "Baixar ZIP", abre uma janela de acompanhamento com barra de progresso, contadores ao vivo e botão "Cancelar". O arquivo .ZIP gerado mantém exatamente a mesma sequência de pastas desde a raiz do Drive até o item selecionado, incluindo subpastas vazias e preservação de nomes iguais.'
  );
  addBullet(
    'Gráfico de Velocidade de Leitura Interativo (7 Métricas por Clique)',
    'O gráfico exibe ondas em tempo real e permite alternar um a um (clicando no componente) entre Velocidade, Tempo Decorrido, Contagem de Arquivos/Pastas, Pasta Atual, ETA, Vazão Média/Pico e Volume Transferido.'
  );

  // UI Illustration 3: Summary Modal Screen Mockup
  drawUiMockupBox('Resumo da Tela Final de Conclusão (Com Tempos Detalhados)', (startY) => {
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(20, startY, pageWidth - 40, 24, 2, 2, 'F');

    doc.setTextColor(252, 211, 77); // amber
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Resumo do Download Concluído com Sucesso', 25, startY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(226, 232, 240);
    doc.text('Leitura Drive: 00:01:12  |  Downloads: 00:03:45  |  Total Geral: 00:04:57', 25, startY + 12);
    doc.text('Arquivos: 142  |  Pastas: 18  |  Volume: 1.25 GB  |  Vel. Média: 4.85 MB/s', 25, startY + 17.5);

    return startY + 24;
  });

  // 4. Passo a Passo
  addSection('4. Como Utilizar o Aplicativo');
  addBullet(
    'Passo 1: Conectar ao Google Drive',
    'Clique em "Conectar com Google Drive" no topo da tela e autorize o acesso de leitura da sua conta Google.'
  );
  addBullet(
    'Passo 2: Configurar a Pasta de Destino',
    'Escolha uma pasta física no seu computador (em nova aba ou aplicativo desktop) para gravar pastas e arquivos diretamente no disco, ou utilize a pasta padrão de Downloads.'
  );
  addBullet(
    'Passo 3: Escolher o Modo de Download',
    'Use "Iniciar o Download" para baixar arquivos e pastas originais sem compactação, "Baixar ZIP" para compactar os itens selecionados mantendo a árvore de pastas, ou "Baixar Tudo" para gerar um .ZIP completo de todo o Meu Drive com suporte a pausa e retomada.'
  );
  addBullet(
    'Passo 4: Acompanhamento e Sincronização Contínua',
    'Acompanhe o progresso na tela central (com opção de cancelar a qualquer momento) e, se desejar, adicione pastas ou arquivos ao painel de Sincronização em Tempo Real.'
  );

  // UI Illustration 4: Step-by-Step Workflow
  drawUiMockupBox('Fluxo de Operação: Conexão, Destino & Execução', (startY) => {
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(20, startY, pageWidth - 40, 24, 2, 2, 'F');

    doc.setTextColor(96, 165, 250); // blue
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('[1] Conectar Conta', 25, startY + 7);
    doc.text('[2] Selecionar Pasta', 72, startY + 7);
    doc.text('[3] Executar Download', 125, startY + 7);

    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('OAuth 2.0 Seguro', 25, startY + 13);
    doc.text('Diretório Local', 72, startY + 13);
    doc.text('Turbo ou ZIP', 125, startY + 13);

    return startY + 24;
  });

  // 5. Motor de Aceleração Turbo
  addSection('5. Como Utilizar o Motor de Aceleração Turbo');
  addParagraph(
    'Localizado logo abaixo da configuração da pasta de destino, o Motor de Aceleração Turbo controla o paralelismo e a velocidade dos downloads realizados por "Iniciar o Download":'
  );
  addBullet(
    '1. Escolha o nível de paralelismo (2x Leve, 4x Rápido, 8x Turbo, 16x Extremo)',
    'Define quantos arquivos são baixados ao mesmo tempo (o padrão inicial é 6 conexões, ajustável antes ou durante o download). Use 2x ou 4x em conexões instáveis, e 8x ou 16x em internet rápida com muitos arquivos.'
  );
  addBullet(
    '2. Ative ou desative o Multi-Chunk (ON / OFF)',
    'Com Multi-Chunk ON (ativo por padrão), arquivos grandes acima de 25 MB são divididos automaticamente em múltiplos blocos paralelos para aproveitar melhor a largura de banda. Clique no botão para alternar para OFF se preferir fluxo único.'
  );
  addBullet(
    '3. Inicie, pare ou continue o download',
    'Selecione os arquivos ou pastas desejados (ou deixe sem seleção para baixar toda a pasta aberta) e clique em "Iniciar o Download". O painel exibe taxa em tempo real, velocidade de pico, volume transferido e conexões ativas. Ao clicar em "Parar o Download", a fila é pausada imediatamente e o botão muda para "Continuar o Download".'
  );

  // UI Illustration 5: Turbo Engine Box
  drawUiMockupBox('Motor de Aceleração Turbo & Conexões Simultâneas', (startY) => {
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(20, startY, pageWidth - 40, 24, 2, 2, 'F');

    doc.setTextColor(110, 231, 183); // emerald
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('⚡ Motor Turbo Ativo: 8x Threads Simultâneas + Multi-Chunk ON', 25, startY + 8);

    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Velocidade Instantânea: 12.4 MB/s  •  Pico: 18.2 MB/s  •  Fila Ativa: 3 arquivos', 25, startY + 15);

    return startY + 24;
  });

  // 6. Desktop
  addSection('6. Versão Desktop Windows (.exe)');
  addParagraph(
    'O projeto possui suporte ao empacotamento desktop via Electron com criação nativa de pastas e abertura direta da pasta de destino no sistema operacional.'
  );

  // UI Illustration 6: Desktop App Mockup
  drawUiMockupBox('Integração Desktop Nativa (Windows .exe)', (startY) => {
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(20, startY, pageWidth - 40, 24, 2, 2, 'F');

    doc.setTextColor(192, 132, 252); // purple
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('🖥️ DriveSync Turbo Desktop (Electron App)', 25, startY + 8);

    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Acesso nativo ao disco rígido (C:/DriveSync) • Notificações na área de trabalho', 25, startY + 15);

    return startY + 24;
  });

  // Footer
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`DriveSync Turbo - Guia do Usuário com Ilustrações | Página ${i} de ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
  }

  doc.save('DriveSync_Turbo_Guia_do_Usuario.pdf');
};
