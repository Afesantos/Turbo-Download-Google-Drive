import React from 'react';
import {
  FileCheck2,
  HardDrive,
  Cloud,
  Calendar,
  Folder,
  FileText,
  Zap,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react';
import { DRIVE_TRACKING_FILE_NAME } from '../services/drive';
import { DriveTrackingCheckResult } from '../services/driveTracking';
import { formatDateTimeClock } from '../utils/zipTiming';

interface DriveTrackingStartupModalProps {
  isOpen: boolean;
  result: DriveTrackingCheckResult | null;
  localFolderName: string | null;
  isDiscarding: boolean;
  onUseFileToAccelerate: () => void;
  onDiscardAndStartFresh: () => void;
  onCloseWithoutDiscarding: () => void;
  onOpenFolderPicker: () => void;
}

export const DriveTrackingStartupModal: React.FC<DriveTrackingStartupModalProps> = ({
  isOpen,
  result,
  localFolderName,
  isDiscarding,
  onUseFileToAccelerate,
  onDiscardAndStartFresh,
  onCloseWithoutDiscarding,
  onOpenFolderPicker,
}) => {
  if (!isOpen || !result) return null;

  const {
    foundLocation,
    trackingData,
    reportedFileCount,
    currentDriveFileCount,
    isSameCount,
    driveFileModifiedTime,
  } = result;

  const fileTimestampMs =
    trackingData.updatedAt ||
    trackingData.endedAt ||
    (driveFileModifiedTime ? new Date(driveFileModifiedTime).getTime() : trackingData.createdAt);

  const formattedFileDate = formatDateTimeClock(fileTimestampMs);

  const originLabel =
    foundLocation === 'local_folder'
      ? `Pasta local (${localFolderName || 'computador'})`
      : foundLocation === 'local_storage'
      ? 'Armazenamento local do computador'
      : 'Raiz do Google Drive';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div
        className={`bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden text-slate-100 my-auto ${
          isSameCount
            ? 'border-emerald-500/45 ring-4 ring-emerald-500/15'
            : 'border-amber-500/45 ring-4 ring-amber-500/15'
        }`}
      >
        <div
          className={`absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl pointer-events-none ${
            isSameCount ? 'bg-emerald-500/15' : 'bg-amber-500/15'
          }`}
        />

        <button
          onClick={onCloseWithoutDiscarding}
          disabled={isDiscarding}
          className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10">
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <div
              className={`w-14 h-14 rounded-2xl border flex items-center justify-center shadow-lg mb-3 ${
                isSameCount
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/20'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-amber-500/20'
              }`}
            >
              <FileCheck2 className="w-7 h-7" />
            </div>

            <div className="flex items-center space-x-2 mb-1.5">
              <span
                className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                  isSameCount
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                }`}
              >
                {isSameCount ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Mesma Quantidade Confirmada</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    <span>Quantidade Alterada no Drive</span>
                  </>
                )}
              </span>
            </div>

            <h3 className="font-extrabold text-lg text-white tracking-tight">
              Arquivo de Acompanhamento Encontrado
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              <strong className="font-mono text-slate-200">{DRIVE_TRACKING_FILE_NAME}</strong>
            </p>
          </div>

          {/* Details & Comparison */}
          <div className="mt-4 space-y-2.5 text-left">
            <div
              className={`rounded-2xl p-3.5 text-xs border leading-relaxed ${
                isSameCount
                  ? 'bg-emerald-950/35 border-emerald-800/70 text-emerald-100'
                  : 'bg-amber-950/35 border-amber-800/70 text-amber-100'
              }`}
            >
              {isSameCount ? (
                <p>
                  O arquivo de acompanhamento de{' '}
                  <strong className="text-white font-mono">{formattedFileDate}</strong> contém{' '}
                  <strong className="text-white">{reportedFileCount}</strong> arquivo(s), exatamente
                  a mesma quantidade encontrada agora no seu Google Drive. Deseja começar a contagem
                  utilizando este arquivo para <strong>acelerar o mapeamento</strong> ou prefere{' '}
                  <strong>descartar o arquivo e começar do zero</strong>?
                </p>
              ) : (
                <p>
                  O arquivo de acompanhamento de{' '}
                  <strong className="text-white font-mono">{formattedFileDate}</strong> relata{' '}
                  <strong className="text-white">{reportedFileCount}</strong> arquivo(s), porém o
                  seu Google Drive possui atualmente{' '}
                  <strong className="text-white">{currentDriveFileCount}</strong> arquivo(s).
                  Recomendamos descartar o arquivo anterior e começar do zero.
                </p>
              )}
            </div>

            {/* Source & Date Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
                  {foundLocation === 'drive_root' ? (
                    <Cloud className="w-3 h-3 text-blue-400" />
                  ) : (
                    <HardDrive className="w-3 h-3 text-emerald-400" />
                  )}
                  <span>Origem Priorizada</span>
                </span>
                <span className="text-xs font-bold text-slate-100 mt-1 block truncate" title={originLabel}>
                  {originLabel}
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  <span>Data do Arquivo</span>
                </span>
                <span className="text-xs font-extrabold font-mono text-white mt-1 block">
                  {formattedFileDate}
                </span>
              </div>
            </div>

            {/* File Count Comparison */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
                  <FileText className="w-3 h-3 text-blue-400" />
                  <span>No Arquivo</span>
                </span>
                <span className="text-base font-extrabold font-mono text-white mt-0.5 block">
                  {reportedFileCount}
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
                  <Cloud className="w-3 h-3 text-emerald-400" />
                  <span>No Drive</span>
                </span>
                <span
                  className={`text-base font-extrabold font-mono mt-0.5 block ${
                    isSameCount ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {currentDriveFileCount}
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
                  <Folder className="w-3 h-3 text-amber-400" />
                  <span>Pastas</span>
                </span>
                <span className="text-base font-extrabold font-mono text-white mt-0.5 block">
                  {trackingData.folderCount}
                </span>
              </div>
            </div>

            {/* Destination Folder Quick Info */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs text-slate-300">
              <div className="flex items-center space-x-2 min-w-0">
                <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">
                  Destino:{' '}
                  <strong className="text-white font-mono">
                    {localFolderName || 'Downloads / DriveSync'}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenFolderPicker}
                className="inline-flex items-center space-x-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 shrink-0"
              >
                <FolderOpen className="w-3 h-3" />
                <span>Alterar</span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={onDiscardAndStartFresh}
              disabled={isDiscarding}
              className="flex-1 flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-rose-950/80 hover:border-rose-700/70 hover:text-rose-200 text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs border border-slate-700 transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDiscarding ? 'Descartando...' : 'Descartar e Começar do Zero'}</span>
            </button>

            {isSameCount ? (
              <button
                onClick={onUseFileToAccelerate}
                disabled={isDiscarding}
                className="flex-1 flex items-center justify-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-600/25 active:scale-95 transition-all disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Usar Arquivo (Acelerar)</span>
              </button>
            ) : (
              <button
                onClick={onCloseWithoutDiscarding}
                disabled={isDiscarding}
                className="flex-1 flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs border border-slate-700 transition-all disabled:opacity-50"
              >
                <span>Fechar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
