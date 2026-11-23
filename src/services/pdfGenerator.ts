import { jsPDF } from 'jspdf';

export const generateUserGuidePDF = () => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header background banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('DriveSync Turbo', 15, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Guia Oficial de Funcionalidades e Manual de Utilização', 15, 30);

  y = 50;

  const addSection = (title: string) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(title, 15, y);
    y += 8;
  };

  const addParagraph = (text: string) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const splitText = doc.splitTextToSize(text, pageWidth - 30);
    doc.text(splitText, 15, y, { lineHeightFactor: 1.35 });
    y += splitText.length * 5.5 + 5;
  };

  const addBullet = (boldTitle: string, description: string) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`• ${boldTitle}`, 15, y);
    y += 5;

    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const descLines = doc.splitTextToSize(description, pageWidth - 30);
    doc.text(descLines, 19, y, { lineHeightFactor: 1.35 });
    y += descLines.length * 5.5 + 5;
  };

  // Content
  addSection('1. Introdução ao DriveSync Turbo');
  addParagraph(
    'O DriveSync Turbo é um aplicativo de alta performance projetado para sincronizar, baixar e gerenciar arquivos do Google Drive diretamente para o seu computador com velocidade máxima, suporte a múltiplos threads simultâneos e sincronização contínua em tempo real.'
  );

  addSection('2. Principais Funcionalidades');
  addBullet('Aceleração Turbo (2x a 16x)', 'Divide arquivos grandes em múltiplos streams paralelos via HTTP Range para saturar sua largura de banda e maximizar a taxa de download.');
  addBullet('Sincronização em Tempo Real', 'Monitora continuamente arquivos e pastas selecionados. Qualquer alteração ou novo arquivo no Google Drive é baixado automaticamente.');
  addBullet('Estrutura de Pastas Idêntica', 'Recria automaticamente no disco do computador exatamente a mesma árvore de pastas e subpastas originais do Google Drive.');
  addBullet('Gravação Nativa ou Rápida', 'Permite salvar diretamente em pastas físicas do disco via File System Access ou na pasta padrão de Downloads.');
  addBullet('Baixar em ZIP', 'Opção para compactar e baixar arquivos ou pastas selecionadas em um único arquivo .ZIP com estrutura preservada.');
  addBullet('Botões Iniciar e Parar', 'Controle total com alternância dinâmica para iniciar, pausar ou interromper transferências a qualquer momento com um clique.');

  addSection('3. Como Utilizar o Aplicativo');
  addBullet('Passo 1: Conectar ao Google Drive', 'Clique no botão "Conectar com Google Drive" no topo da tela e faça login com sua conta Google para autorizar o acesso de leitura.');
  addBullet('Passo 2: Configurar a Pasta de Destino', 'Clique em "Configurar Pasta no Computador" e escolha entre usar a pasta padrão de Downloads ou selecionar um diretório físico no seu disco.');
  addBullet('Passo 3: Iniciar o Download', 'Navegue pelas pastas do seu Google Drive, selecione os itens desejados (ou deixe tudo visível) e clique em "Iniciar o Download". Uma barra de progresso central exibirá o andamento em tempo real.');
  addBullet('Passo 4: Sincronização Automática', 'Adicione arquivos ou pastas cruciais ao monitoramento contínuo para que o app verifique alterações automaticamente.');

  addSection('4. Versão Desktop Windows (.exe)');
  addParagraph(
    'O aplicativo está configurado para empacotamento desktop via Electron. Para gerar um arquivo executável nativo .exe no Windows, utilize os comandos de build do projeto (npm run electron:build).'
  );

  // Footer
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`DriveSync Turbo - Guia do Usuário | Página ${i} de ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
  }

  doc.save('DriveSync_Turbo_Guia_do_Usuario.pdf');
};
