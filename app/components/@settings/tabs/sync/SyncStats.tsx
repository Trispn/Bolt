import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import type { SyncHistoryEntry, SyncSession, TimeRange } from '~/types/sync';
import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-toastify';
import { IconButton } from '~/components/ui/IconButton';
import { classNames } from '~/utils/classNames';
import { formatFileSize } from '~/utils/fileUtils';
import StatsCard from './StatsCard';
import TimeRangeSelector from './TimeRangeSelector';
import HistoryEntry from './HistoryEntry';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '~/components/ui/Progress';

const timeRangeOptions = [
  { value: '24h' as TimeRange, label: 'Last 24h' },
  { value: '7d' as TimeRange, label: 'Last 7d' },
  { value: '30d' as TimeRange, label: 'Last 30d' },
  { value: 'all' as TimeRange, label: 'All time' },
];

const SYNC_HISTORY_KEY = 'syncHistory';
const ITEMS_PER_PAGE = 10;
const UPDATE_INTERVAL = 10000; // 10 seconds

export default function SyncStats() {
  const currentSession = useStore(workbenchStore.currentSession);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('all');
  const [isClearing, setIsClearing] = useState(false);
  const [page, setPage] = useState(1);

  // Load initial history from localStorage and set up real-time updates
  useEffect(() => {
    const loadHistory = () => {
      try {
        const history = JSON.parse(localStorage.getItem(SYNC_HISTORY_KEY) || '[]');

        if (Array.isArray(history)) {
          setSyncHistory(history);
        } else {
          console.error('Invalid sync history format in localStorage');
          localStorage.setItem(SYNC_HISTORY_KEY, '[]');
          setSyncHistory([]);
        }
      } catch (error) {
        console.error('Failed to load sync history:', error);
        localStorage.setItem(SYNC_HISTORY_KEY, '[]');
        setSyncHistory([]);
      }
    };

    // Initial load
    loadHistory();

    // Set up polling interval for real-time updates
    const interval = setInterval(loadHistory, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Update history when new syncs happen
  useEffect(() => {
    if (currentSession?.history) {
      setSyncHistory((prev) => {
        try {
          const newHistory = [...prev];

          for (const entry of currentSession.history) {
            const existingIndex = newHistory.findIndex((h) => h.id === entry.id);

            if (existingIndex === -1) {
              newHistory.push(entry);
            } else {
              newHistory[existingIndex] = entry;
            }
          }

          newHistory.sort((a, b) => b.timestamp - a.timestamp);

          const latestHistory = newHistory.slice(0, 100);
          localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(latestHistory));

          return latestHistory;
        } catch (error) {
          console.error('Failed to update sync history:', error);
          return prev;
        }
      });
    }
  }, [currentSession?.history]);

  // Reset page when time range changes
  useEffect(() => {
    setPage(1);
  }, [selectedTimeRange]);

  const handleClearHistory = useCallback(async () => {
    if (isClearing) {
      return;
    }

    if (confirm('Are you sure you want to clear all sync history? This cannot be undone.')) {
      try {
        setIsClearing(true);
        localStorage.setItem(SYNC_HISTORY_KEY, '[]');
        setSyncHistory([]);
        setExpandedEntries(new Set());

        if (currentSession) {
          const clearedSession: SyncSession = {
            ...currentSession,
            id: currentSession.id,
            timestamp: currentSession.timestamp,
            history: [],
            statistics: [],
            files: new Set(),
          };
          await workbenchStore.currentSession.set(clearedSession);
        }

        toast.success('Sync history cleared');
      } catch (error) {
        console.error('Failed to clear sync history:', error);
        toast.error('Failed to clear sync history');
      } finally {
        setIsClearing(false);
      }
    }
  }, [currentSession, isClearing]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }, []);

  const getFilteredHistory = useCallback(() => {
    const now = Date.now();

    return syncHistory.filter((entry) => {
      switch (selectedTimeRange) {
        case '24h':
          return now - entry.timestamp < 24 * 60 * 60 * 1000;
        case '7d':
          return now - entry.timestamp < 7 * 24 * 60 * 60 * 1000;
        case '30d':
          return now - entry.timestamp < 30 * 24 * 60 * 60 * 1000;
        default:
          return true;
      }
    });
  }, [syncHistory, selectedTimeRange]);

  const filteredHistory = getFilteredHistory();
  const totalSyncs = filteredHistory.length;
  const totalFilesSynced = filteredHistory.reduce((sum, entry) => sum + entry.statistics.totalFiles, 0);
  const totalDataSynced = filteredHistory.reduce((sum, entry) => sum + entry.statistics.totalSize, 0);
  const averageDuration =
    totalSyncs > 0 ? filteredHistory.reduce((sum, entry) => sum + entry.statistics.duration, 0) / totalSyncs / 1000 : 0;

  const getTrends = useCallback(() => {
    const currentPeriod = filteredHistory.slice(0, Math.floor(filteredHistory.length / 2));
    const previousPeriod = filteredHistory.slice(Math.floor(filteredHistory.length / 2));

    const calculateTrend = (current: number, previous: number) => {
      if (previous === 0) {
        return undefined;
      }

      const change = ((current - previous) / previous) * 100;
      const value = Math.abs(Math.round(change));
      const progress = Math.min(100, Math.abs(change));

      return {
        value,
        progress,
        label: `${value}% ${change >= 0 ? 'increase' : 'decrease'}`,
      };
    };

    return {
      syncs: calculateTrend(currentPeriod.length, previousPeriod.length),
      files: calculateTrend(
        currentPeriod.reduce((sum, entry) => sum + entry.statistics.totalFiles, 0),
        previousPeriod.reduce((sum, entry) => sum + entry.statistics.totalFiles, 0),
      ),
      data: calculateTrend(
        currentPeriod.reduce((sum, entry) => sum + entry.statistics.totalSize, 0),
        previousPeriod.reduce((sum, entry) => sum + entry.statistics.totalSize, 0),
      ),
      duration: calculateTrend(
        currentPeriod.reduce((sum, entry) => sum + entry.statistics.duration, 0) / currentPeriod.length,
        previousPeriod.reduce((sum, entry) => sum + entry.statistics.duration, 0) / previousPeriod.length,
      ),
    };
  }, [filteredHistory]);

  const trends = getTrends();

  if (!syncHistory.length) {
    return (
      <motion.div
        className={classNames(
          'rounded-lg bg-bolt-elements-background text-bolt-elements-textPrimary shadow-sm p-4',
          'hover:bg-bolt-elements-background-depth-2',
          'transition-all duration-200',
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="space-y-6">
          {/* Header section */}
          <div className="flex items-center justify-between gap-4 border-b border-bolt-elements-borderColor pb-4">
            <div className="flex items-center gap-3">
              <motion.div
                className={classNames(
                  'w-10 h-10 flex items-center justify-center rounded-xl',
                  'bg-purple-500/10 text-purple-500',
                )}
                whileHover={{ scale: 1.05 }}
              >
                <div className="i-ph:sliders-horizontal w-6 h-6" />
              </motion.div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">No Sync History</h2>
                </div>
                <p className="text-sm text-bolt-elements-textSecondary">
                  Start syncing your files to see statistics here
                </p>
              </div>
            </div>
          </div>

          {/* Quick start guide */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              className={classNames(
                'p-4 rounded-xl',
                'bg-bolt-elements-background-depth-2',
                'hover:bg-bolt-elements-background-depth-3',
                'transition-all duration-200',
              )}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="i-ph:folder-simple-plus text-purple-500 w-5 h-5" />
                <h3 className="text-sm font-medium text-bolt-elements-textPrimary">Create Project</h3>
              </div>
              <p className="text-xs text-bolt-elements-textSecondary">Create a new project or open an existing one</p>
            </motion.div>

            <motion.div
              className={classNames(
                'p-4 rounded-xl',
                'bg-bolt-elements-background-depth-2',
                'hover:bg-bolt-elements-background-depth-3',
                'transition-all duration-200',
              )}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="i-ph:git-branch text-purple-500 w-5 h-5" />
                <h3 className="text-sm font-medium text-bolt-elements-textPrimary">Connect Repository</h3>
              </div>
              <p className="text-xs text-bolt-elements-textSecondary">Link your project to a Git repository</p>
            </motion.div>

            <motion.div
              className={classNames(
                'p-4 rounded-xl',
                'bg-bolt-elements-background-depth-2',
                'hover:bg-bolt-elements-background-depth-3',
                'transition-all duration-200',
              )}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="i-ph:cloud-arrow-up text-purple-500 w-5 h-5" />
                <h3 className="text-sm font-medium text-bolt-elements-textPrimary">Start Syncing</h3>
              </div>
              <p className="text-xs text-bolt-elements-textSecondary">Begin syncing your files automatically</p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    );
  }

  const paginatedHistory = filteredHistory.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);

  return (
    <motion.div
      className={classNames(
        'rounded-lg bg-bolt-elements-background text-bolt-elements-textPrimary shadow-sm p-4',
        'hover:bg-bolt-elements-background-depth-2',
        'transition-all duration-200',
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="space-y-6">
        {/* Header section */}
        <div className="flex items-center justify-between gap-4 border-b border-bolt-elements-borderColor pb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className={classNames(
                'w-10 h-10 flex items-center justify-center rounded-xl',
                'bg-purple-500/10 text-purple-500',
              )}
              whileHover={{ scale: 1.05 }}
            >
              <div className="i-ph:sliders-horizontal w-6 h-6" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Sync History</h2>
                <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/10 text-purple-500">
                  {totalSyncs} syncs
                </span>
              </div>
              <p className="text-sm text-bolt-elements-textSecondary">Track and manage your file synchronization</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <TimeRangeSelector
              value={selectedTimeRange}
              onChange={(value: TimeRange) => setSelectedTimeRange(value)}
              options={timeRangeOptions}
            />
            <IconButton
              onClick={handleClearHistory}
              disabled={isClearing}
              className={classNames(
                'text-bolt-elements-textSecondary transition-theme',
                'hover:text-red-400',
                'bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3',
                'p-2 rounded-lg',
                { 'opacity-50 cursor-not-allowed': isClearing },
              )}
              title="Clear History"
            >
              <div className={classNames('i-ph:trash w-4 h-4', { 'animate-pulse': isClearing })} />
            </IconButton>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard icon="i-ph:sliders-horizontal" label="Total Syncs" value={totalSyncs} trend={trends.syncs} />
          <StatsCard icon="i-ph:files" label="Files Synced" value={totalFilesSynced} trend={trends.files} />
          <StatsCard
            icon="i-ph:database"
            label="Data Synced"
            value={formatFileSize(totalDataSynced)}
            trend={trends.data}
          />
          <StatsCard
            icon="i-ph:timer"
            label="Average Duration"
            value={`${averageDuration.toFixed(1)}s`}
            trend={trends.duration}
          />
        </div>

        {/* Latest Sync Overview */}
        {filteredHistory.length > 0 && (
          <motion.div
            className={classNames(
              'bg-bolt-elements-background-depth-2 rounded-xl p-5',
              'hover:bg-bolt-elements-background-depth-3',
              'transition-all duration-200',
              'border border-bolt-elements-borderColor/10',
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.01 }}
          >
            <h4 className="text-sm font-medium mb-4 flex items-center gap-2 text-bolt-elements-textPrimary">
              <div className="i-ph:clock-clockwise text-purple-500" />
              Latest Synchronization
            </h4>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="i-ph:folder text-purple-500 w-4 h-4" />
                  <span className="text-sm text-bolt-elements-textPrimary truncate">
                    {filteredHistory[0].projectName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="i-ph:clock text-purple-500 w-4 h-4" />
                  <span className="text-sm text-bolt-elements-textPrimary">
                    {formatDistanceToNow(filteredHistory[0].timestamp)} ago
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="i-ph:files text-purple-500 w-4 h-4" />
                  <span className="text-sm text-bolt-elements-textPrimary">
                    {filteredHistory[0].statistics.totalFiles} files
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="i-ph:database text-purple-500 w-4 h-4" />
                  <span className="text-sm text-bolt-elements-textPrimary">
                    {formatFileSize(filteredHistory[0].statistics.totalSize)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="i-ph:timer text-purple-500 w-4 h-4" />
                  <span className="text-sm text-bolt-elements-textPrimary">
                    {(filteredHistory[0].statistics.duration / 1000).toFixed(1)}s
                  </span>
                </div>
                <Progress value={100} className="h-1.5 bg-purple-500/10 [&>div]:bg-purple-500" />
              </div>
            </div>
          </motion.div>
        )}

        {/* History List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2 text-bolt-elements-textPrimary">
              <div className="i-ph:list-numbers text-purple-500" />
              Sync History
            </h4>
            <span className="text-xs text-bolt-elements-textSecondary">
              Showing {paginatedHistory.length} of {filteredHistory.length} entries
            </span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-bolt-elements-borderColor scrollbar-track-transparent">
            <AnimatePresence>
              {paginatedHistory.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <HistoryEntry
                    entry={entry}
                    expanded={expandedEntries.has(entry.id)}
                    onToggle={() => toggleExpand(entry.id)}
                    formatters={{ size: formatFileSize, time: formatDistanceToNow }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-4 border-t border-bolt-elements-borderColor">
            <IconButton
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={classNames(
                'text-bolt-elements-textSecondary transition-theme',
                'bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3',
                'p-2 rounded-lg disabled:opacity-50',
              )}
            >
              <div className="i-ph:caret-left w-4 h-4" />
            </IconButton>
            <span className="text-sm text-bolt-elements-textSecondary">
              Page {page} of {totalPages}
            </span>
            <IconButton
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={classNames(
                'text-bolt-elements-textSecondary transition-theme',
                'bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3',
                'p-2 rounded-lg disabled:opacity-50',
              )}
            >
              <div className="i-ph:caret-right w-4 h-4" />
            </IconButton>
          </div>
        )}
      </div>
    </motion.div>
  );
}
