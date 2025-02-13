import { classNames } from '~/utils/classNames';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '~/components/ui/Progress';
import { formatFileSize } from '~/utils/fileUtils';

interface HistoryEntryProps {
  entry: {
    id: string;
    projectName: string;
    timestamp: number;
    status: 'success' | 'partial' | 'failed';
    files: string[];
    statistics: {
      totalFiles: number;
      totalSize: number;
      duration: number;
      progress?: number;
      filesProcessed?: number;
      currentFile?: string;
      speed?: number;
    };
  };
  expanded: boolean;
  onToggle: () => void;
  formatters: {
    time: (timestamp: number) => string;
    size: (bytes: number) => string;
  };
}

export default function HistoryEntry({ entry, expanded, onToggle, formatters }: HistoryEntryProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'success':
        return {
          icon: 'i-ph:sliders-horizontal',
          color: 'text-purple-500',
          background: 'bg-purple-500/10',
          label: 'Completed',
        };
      case 'partial':
        return {
          icon: 'i-ph:sliders-horizontal',
          color: 'text-orange-500',
          background: 'bg-orange-500/10',
          label: 'In Progress',
        };
      case 'failed':
        return {
          icon: 'i-ph:sliders-horizontal',
          color: 'text-red-500',
          background: 'bg-red-500/10',
          label: 'Failed',
        };
      default:
        return {
          icon: 'i-ph:sliders-horizontal',
          color: 'text-gray-500',
          background: 'bg-gray-500/10',
          label: 'Unknown',
        };
    }
  };

  const statusConfig = getStatusConfig(entry.status);
  const progress =
    entry.status === 'success'
      ? 100
      : entry.status === 'partial' && entry.statistics.filesProcessed !== undefined
        ? Math.round((entry.statistics.filesProcessed / entry.statistics.totalFiles) * 100)
        : 0;
  const speed = entry.statistics.speed ? `${formatFileSize(entry.statistics.speed)}/s` : 'N/A';

  return (
    <motion.div
      className={classNames(
        'bg-bolt-elements-background-depth-2 rounded-xl',
        'hover:bg-bolt-elements-background-depth-3',
        'border border-bolt-elements-borderColor/10',
        'transition-all duration-200',
        'group',
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
    >
      <div className="p-4" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              className={classNames('w-8 h-8 flex items-center justify-center rounded-lg', statusConfig.background)}
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
            >
              <div className={classNames(statusConfig.icon, statusConfig.color, 'w-5 h-5')} />
            </motion.div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-bolt-elements-textPrimary group-hover:text-accent-500 transition-colors">
                  {entry.projectName}
                </span>
                <span
                  className={classNames(
                    'px-2 py-0.5 text-xs rounded-full font-medium',
                    statusConfig.background,
                    statusConfig.color,
                  )}
                >
                  {statusConfig.label}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-bolt-elements-textSecondary">
                <div className="flex items-center gap-1">
                  <div className="i-ph:clock w-3.5 h-3.5" />
                  <span>{formatters.time(entry.timestamp)} ago</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="i-ph:files w-3.5 h-3.5" />
                  <span>
                    {entry.statistics.filesProcessed ?? entry.statistics.totalFiles} / {entry.statistics.totalFiles}{' '}
                    files
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="i-ph:database w-3.5 h-3.5" />
                  <span>{formatters.size(entry.statistics.totalSize)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="i-ph:gauge w-3.5 h-3.5" />
                  <span>{speed}</span>
                </div>
              </div>
            </div>
          </div>

          <motion.div
            className={classNames(
              'i-ph:caret-down w-4 h-4',
              'text-bolt-elements-textTertiary group-hover:text-accent-500',
              'transition-colors',
            )}
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          />
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              className="mt-4 pt-4 border-t border-bolt-elements-borderColor/10"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-bolt-elements-textSecondary">
                    <span>Sync Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress
                    value={progress}
                    className={classNames('h-1', {
                      'bg-purple-500/10 [&>div]:bg-purple-500': entry.status === 'success',
                      'bg-orange-500/10 [&>div]:bg-orange-500': entry.status === 'partial',
                      'bg-red-500/10 [&>div]:bg-red-500': entry.status === 'failed',
                    })}
                  />
                  {entry.statistics.currentFile && (
                    <div className="text-xs text-bolt-elements-textTertiary flex items-center gap-1.5">
                      <div className="i-ph:arrow-right w-3 h-3" />
                      <span className="truncate">{entry.statistics.currentFile}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div className="font-medium text-bolt-elements-textSecondary">Transfer Details</div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-bolt-elements-textSecondary">Speed</span>
                        <span className="text-bolt-elements-textPrimary">{speed}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-bolt-elements-textSecondary">Duration</span>
                        <span className="text-bolt-elements-textPrimary">
                          {(entry.statistics.duration / 1000).toFixed(1)}s
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-bolt-elements-textSecondary">Total Size</span>
                        <span className="text-bolt-elements-textPrimary">
                          {formatters.size(entry.statistics.totalSize)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="font-medium text-bolt-elements-textSecondary">Files</div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-bolt-elements-textSecondary">Total</span>
                        <span className="text-bolt-elements-textPrimary">{entry.statistics.totalFiles}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-bolt-elements-textSecondary">Processed</span>
                        <span className="text-bolt-elements-textPrimary">
                          {entry.statistics.filesProcessed ?? entry.statistics.totalFiles}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-bolt-elements-textSecondary">Remaining</span>
                        <span className="text-bolt-elements-textPrimary">
                          {entry.statistics.filesProcessed
                            ? entry.statistics.totalFiles - entry.statistics.filesProcessed
                            : 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-bolt-elements-textSecondary">Synced Files</div>
                  <div className="grid grid-cols-2 gap-2">
                    {entry.files.map((file, index) => (
                      <motion.div
                        key={file}
                        className={classNames(
                          'text-xs text-bolt-elements-textSecondary',
                          'hover:text-bolt-elements-textPrimary',
                          'transition-colors flex items-center gap-2',
                          'truncate',
                        )}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="i-ph:file-text w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{file}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
