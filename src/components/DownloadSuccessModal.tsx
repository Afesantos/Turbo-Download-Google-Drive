import React, { useState } from 'react';
import {
  CheckCircle2,
  FolderOpen,
  Copy,
  Check,
  X,
  HardDrive,
  ArrowRight,
  Sparkles,
  Info,
  Clock,
  Folder,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { formatBytes } from '../utils/formatters';

interface DownloadSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  completedCount: number;
  folderCount?: number;
  totalBytes: number;
  elapsedSeconds?: number;
  folderName: string | null;
  isZip?: boolean;
  onOpenFolderPicker?: () => void;
}

export const DownloadSuccessModal: React.FC<DownloadSuccessModalProps> = ({
  isOpen,
  onClose,
  completedCount,
  folderCount = 1,
  totalBytes,
  elapsedSeconds = 0,
  folderName,
  isZip = false,
  onOpenFolderPicker,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const folderDisplay = folderName || 'Downloads / DriveSync';

  const handleCopyPath = () => {
    navigator.clipboard.writeText(folderDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formatElapsed = (sec: number): string => {
    if (!sec || sec <= 0) return 'Menos de 1 min';
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    if (mins === 0) return `${secs} segundo(s)`;
    return `${mins} min ${secs} seg`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-emerald-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative overflow-hidden text-slate-100 ring-4 ring-emerald-500/10">
        {/* Glow accent */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Success Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40 flex items-center justify-center shadow-xl shadow-emerald-500/20 mb-4 animate-bounce">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Processo Concluído com Sucesso</span>
          </div>

          <h3 className="font-extrabold text-xl text-white tracking-tight">
            {isZip ? 'Arquivo ZIP Gerado!' : 'Sincronização Finalizada'}
          </h3>

          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Todos os arquivos e pastas selecionados foram baixados mantendo a estrutura original intacta.
          </p>
        </div>

        {/* Summary Card with Metrics */}
        <div className="mt-6 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-900">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Arquivos</div>
                <div className="text-sm font-mono font-bold text-white">{completedCount}</div>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Folder className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Pastas</div>
                <div className="text-sm font-mono font-bold text-white">{folderCount}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-400 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              <span>Tempo Gasto:</span>
            </span>
            <span className="font-mono font-bold text-orange-400">{formatElapsed(elapsedSeconds)}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Total transferido:</span>
            <span className="font-mono font-bold text-emerald-400">{formatBytes(totalBytes)}</span>
          </div>

          <div className="pt-2 border-t border-slate-900">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold">
                Pasta de Destino no Computador:
              </span>
              <button
                onClick={handleCopyPath}
                className="flex items-center space-x-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar Caminho</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2 truncate">
                <HardDrive className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs text-blue-200 font-mono font-bold truncate">
                  {folderDisplay}
                </span>
              </div>
              <button
                onClick={handleCopyPath}
                className="shrink-0 text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-lg font-medium flex items-center space-x-1"
                title="Copiar link da pasta para abrir no Explorer / Finder"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Abrir Pasta</span>
              </button>
            </div>
          </div>

          {/* Browser security notice */}
          <div className="flex items-start space-x-2 text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Para visualizar os arquivos baixados, clique em <strong>Abrir Pasta</strong> ou abra o Explorador de Arquivos na pasta de <strong>Downloads</strong> do seu computador.
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          {onOpenFolderPicker && (
            <button
              onClick={() => {
                onClose();
                onOpenFolderPicker();
              }}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-3 rounded-2xl text-xs border border-slate-700 transition-all justify-center"
            >
              <FolderOpen className="w-4 h-4 text-blue-400" />
              <span>Trocar Pasta</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-3 rounded-2xl text-xs shadow-lg shadow-emerald-600/25 active:scale-95 transition-all"
          >
            <span>Concluído</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};
