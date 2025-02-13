import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import SyncStats from './SyncStats';
import { classNames } from '~/utils/classNames';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { BiSync } from 'react-icons/bi';
import { toast } from 'react-toastify';

export default function SyncTab() {
  const syncFolder = useStore(workbenchStore.syncFolder);
  const syncSettings = useStore(workbenchStore.syncSettings);
  const currentSession = useStore(workbenchStore.currentSession);
  const syncStatus = useStore(workbenchStore.syncStatus);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [folderStats, setFolderStats] = useState<{ files: number; size: number; lastModified: number }>({
    files: 0,
    size: 0,
    lastModified: 0,
  });

  const handleSelectFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker();
      await workbenchStore.setSyncFolder(handle);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      console.error('Failed to select sync folder:', error);
    }
  };

  const handleManualSync = async () => {
    if (!syncFolder) {
      return;
    }

    try {
      setIsManualSyncing(true);
      await workbenchStore.syncFiles();

      // Force immediate updates
      updateLastSyncTime();
      updateSyncStats();
    } catch (error) {
      console.error('Manual sync error:', error);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleSaveSettings = (settings: Partial<typeof syncSettings>) => {
    workbenchStore.saveSyncSettings({
      ...syncSettings,
      ...settings,
    });

    // Add toast notifications for different settings
    if ('defaultSyncEnabled' in settings) {
      toast.success(`New projects will ${settings.defaultSyncEnabled ? 'be synced' : 'not be synced'} by default`);
    }

    if ('autoSync' in settings) {
      toast.success(`Automatic sync ${settings.autoSync ? 'enabled' : 'disabled'}`);
    }

    if ('autoSyncInterval' in settings) {
      toast.success(`Auto-sync interval set to ${settings.autoSyncInterval} minutes`);
    }

    if ('syncOnSave' in settings) {
      toast.success(`Sync on save ${settings.syncOnSave ? 'enabled' : 'disabled'}`);
    }
  };

  const updateLastSyncTime = useCallback(() => {
    const lastSync = currentSession?.lastSync;

    if (!lastSync) {
      setLastSyncTime('');
      return;
    }

    const now = Date.now();
    const diff = now - lastSync;
    const date = new Date(lastSync);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}:${seconds}`;

    if (diff < 60000) {
      // less than 1 minute
      setLastSyncTime(timeString);
    } else if (diff < 3600000) {
      // less than 1 hour
      const mins = Math.floor(diff / 60000);
      setLastSyncTime(`${timeString} (${mins}m ago)`);
    } else {
      // more than 1 hour
      const hours = Math.floor(diff / 3600000);
      setLastSyncTime(`${timeString} (${hours}h ago)`);
    }
  }, [currentSession?.lastSync]);

  const updateSyncStats = useCallback(() => {
    if (currentSession?.statistics?.length) {
      const latest = currentSession.statistics[currentSession.statistics.length - 1];
      setFolderStats({
        files: latest.totalFiles,
        size: latest.totalSize,
        lastModified: Date.now(), // Use current timestamp since statistics don't include lastModified
      });
    }
  }, [currentSession?.statistics]);

  // Update stats whenever session changes
  useEffect(() => {
    updateSyncStats();
    updateLastSyncTime();
  }, [currentSession, updateSyncStats, updateLastSyncTime]);

  // Update last sync time periodically
  useEffect(() => {
    if (!currentSession?.lastSync) {
      setLastSyncTime('');
      return undefined;
    }

    const interval = setInterval(updateLastSyncTime, 10000);

    return () => clearInterval(interval);
  }, [currentSession?.lastSync, updateLastSyncTime]);

  // Add a function to scan folder and get accurate stats
  const updateFolderStats = useCallback(async () => {
    if (!syncFolder) {
      return;
    }

    try {
      let totalFiles = 0;
      let totalSize = 0;
      let lastModified = 0;

      // Function to recursively process files in a directory
      const processDirectory = async (dirHandle: FileSystemDirectoryHandle) => {
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
            const fileHandle = entry as FileSystemFileHandle;
            const file = await fileHandle.getFile();
            totalFiles++;
            totalSize += file.size;
            lastModified = Math.max(lastModified, file.lastModified);
          } else if (entry.kind === 'directory') {
            const dirHandle = entry as FileSystemDirectoryHandle;
            await processDirectory(dirHandle);
          }
        }
      };

      await processDirectory(syncFolder);
      setFolderStats({ files: totalFiles, size: totalSize, lastModified });

      // Update UI with accurate stats
    } catch (error) {
      console.error('Error scanning folder:', error);
      toast.error('Failed to scan folder for statistics');
    }
  }, [syncFolder]);

  // Update folder stats when folder changes or periodically
  useEffect(() => {
    if (!syncFolder) {
      return undefined;
    }

    updateFolderStats();

    const interval = setInterval(updateFolderStats, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [syncFolder, updateFolderStats]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) {
      return '0 B';
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <motion.div
      className={classNames(
        'rounded-lg shadow-sm p-4 relative',
        'bg-bolt-elements-background text-bolt-elements-textPrimary',
        'border border-bolt-elements-borderColor',
        'hover:bg-bolt-elements-background-depth-2',
        'transition-all duration-200',
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      role="region"
      aria-label="Sync Configuration"
    >
      <span className="absolute top-4 right-4 px-2 py-0.5 text-xs font-medium text-purple-500 bg-purple-500/10 rounded-md">
        BETA
      </span>
      <div className="space-y-6">
        {/* Header section */}
        <div className="flex items-center justify-between gap-4 border-b border-bolt-elements-borderColor pb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className={classNames(
                'w-10 h-10 flex items-center justify-center rounded-xl',
                'bg-purple-500/10 dark:bg-purple-500/20',
                'text-purple-500 dark:text-purple-400',
                'transition-all duration-200',
              )}
              whileHover={{ scale: 1.05, rotate: 15 }}
              whileTap={{ scale: 0.95 }}
            >
              <BiSync className="w-6 h-6" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">File Synchronization</h2>
                <span className="px-2 py-0.5 text-xs rounded-md bg-purple-500/10 text-purple-500 font-medium">
                  BETA
                </span>
              </div>
              <p className="text-sm text-bolt-elements-textSecondary">Configure and manage your file sync settings</p>
            </div>
          </div>
        </div>

        {/* Sync Controls */}
        <motion.div
          className={classNames(
            'rounded-xl p-5 relative overflow-hidden group',
            'bg-bolt-elements-background-depth-2',
            'hover:bg-bolt-elements-background-depth-3',
            'border border-bolt-elements-borderColor',
            'transition-all duration-200',
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.01 }}
        >
          <h3 className="text-md font-semibold text-bolt-elements-textPrimary mb-4">Sync Controls</h3>
          <div className="space-y-4">
            {/* Status and Actions */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor">
              <div>
                <div className="text-sm font-medium text-bolt-elements-textPrimary">Sync Status</div>
                {syncFolder && lastSyncTime && (
                  <div className="text-xs text-bolt-elements-textSecondary mt-0.5 flex items-center gap-2">
                    <div className="i-ph:clock-duotone text-bolt-elements-textPrimary" />
                    Last synced {lastSyncTime}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <motion.div
                  className={classNames(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg',
                    'bg-bolt-elements-background-depth-3',
                    'text-bolt-elements-textSecondary',
                    'border border-bolt-elements-borderColor/50',
                    'transition-all duration-200',
                  )}
                  whileHover={{ scale: 1.02 }}
                >
                  <SyncStatusIndicator status={isManualSyncing ? 'syncing' : !syncStatus.isReady ? 'error' : 'idle'} />
                  <span className="text-sm">Idle</span>
                </motion.div>
                <motion.button
                  onClick={handleSelectFolder}
                  className={classNames(
                    'text-sm px-4 py-1.5',
                    'bg-bolt-elements-background-depth-3',
                    'hover:bg-bolt-elements-background-depth-4',
                    'text-bolt-elements-textPrimary',
                    'border border-bolt-elements-borderColor/50',
                    'hover:border-bolt-elements-borderColor',
                    'transition-all duration-200 rounded-lg',
                    'flex items-center gap-2',
                    'shadow-sm hover:shadow-md',
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="i-ph:folder-simple-plus-duotone text-purple-500" />
                  {syncFolder ? 'Change Main Folder' : 'Set Main Folder'}
                </motion.button>
                {syncFolder && (
                  <motion.button
                    onClick={handleManualSync}
                    disabled={isManualSyncing}
                    aria-label={isManualSyncing ? 'Sync in progress...' : 'Manually sync files now'}
                    className={classNames(
                      'text-sm px-4 py-1.5',
                      'bg-purple-500 hover:bg-purple-600',
                      'text-white font-medium',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'transition-all duration-200 rounded-lg',
                      'flex items-center gap-2',
                      'shadow-sm hover:shadow-md',
                      'border border-purple-400 hover:border-purple-500',
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={classNames('i-ph:arrows-clockwise-duotone', { 'animate-spin': isManualSyncing })} />
                    {isManualSyncing ? 'Syncing...' : 'Sync Now'}
                  </motion.button>
                )}
              </div>
            </div>

            {/* Sync Settings Indicators */}
            {(syncSettings.autoSync || syncSettings.syncOnSave) && (
              <motion.div
                className="flex items-center gap-4 p-3 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                {syncSettings.autoSync && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-sm shadow-green-500/20" />
                    <span className="text-green-500">Auto-sync every {syncSettings.autoSyncInterval}m</span>
                  </div>
                )}
                {syncSettings.syncOnSave && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <div className="i-ph:check-circle-duotone text-green-500" />
                    <span className="text-green-500">Sync on save</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Folders */}
            <div className="space-y-3">
              {/* Main Sync Folder */}
              <div className="flex items-center gap-4 p-3 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="i-ph:folder-simple-duotone text-2xl text-bolt-elements-textPrimary" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-bolt-elements-textSecondary">Main Sync Folder</span>
                      {syncFolder ? (
                        <>
                          <span className="truncate font-medium text-bolt-elements-textPrimary">{syncFolder.name}</span>
                          {folderStats.lastModified > 0 && (
                            <span className="text-xs text-bolt-elements-textSecondary">
                              Last modified: {new Date(folderStats.lastModified).toLocaleString()}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-bolt-elements-textSecondary italic">No folder selected</span>
                      )}
                    </div>
                  </div>
                </div>
                {syncFolder && (
                  <div className="flex items-center gap-4 text-sm text-bolt-elements-textSecondary border-l border-bolt-elements-borderColor pl-4">
                    <div className="flex items-center gap-2">
                      <div className="i-ph:files-duotone" />
                      <span>{folderStats.files.toLocaleString()} files</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="i-ph:database-duotone" />
                      <span>{formatFileSize(folderStats.size)}</span>
                    </div>
                    <motion.button
                      onClick={updateFolderStats}
                      className="text-bolt-elements-textSecondary hover:text-purple-500 transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="Refresh folder statistics"
                    >
                      <div className="i-ph:arrows-clockwise-duotone w-4 h-4" />
                    </motion.button>
                  </div>
                )}
              </div>

              {/* Project Folder */}
              {syncFolder && currentSession?.projectFolder && (
                <div className="flex items-center gap-4 p-3 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="i-ph:folder-notch-duotone text-2xl text-bolt-elements-textPrimary" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-bolt-elements-textSecondary">Project Folder</span>
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-bolt-elements-textPrimary">
                            {currentSession.projectFolder}
                          </span>
                          {currentSession.projectName && (
                            <span className="text-xs text-bolt-elements-textSecondary">
                              ({currentSession.projectName})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Sync Settings */}
        <motion.div
          className={classNames(
            'rounded-xl p-5 relative overflow-hidden group',
            'bg-bolt-elements-background-depth-2',
            'hover:bg-bolt-elements-background-depth-3',
            'border border-bolt-elements-borderColor',
            'transition-all duration-200',
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.01 }}
        >
          <h3 className="text-md font-semibold text-bolt-elements-textPrimary mb-4">Sync Settings</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm text-bolt-elements-textPrimary">Sync Settings</div>
              <div className="space-y-4">
                {/* Default Sync Behavior */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-bolt-elements-background-depth-3">
                  <div>
                    <div className="text-sm font-medium text-bolt-elements-textPrimary">Default Sync Behavior</div>
                    <div className="text-xs text-bolt-elements-textSecondary mt-0.5">
                      Choose whether new projects should be synced by default
                    </div>
                  </div>
                  <motion.button
                    onClick={() => handleSaveSettings({ defaultSyncEnabled: !syncSettings.defaultSyncEnabled })}
                    className={classNames(
                      'relative w-11 h-6 rounded-full transition-colors duration-200',
                      syncSettings.defaultSyncEnabled ? 'bg-purple-500' : 'bg-bolt-elements-background-depth-4',
                    )}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.div
                      className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white"
                      animate={{ x: syncSettings.defaultSyncEnabled ? 20 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </motion.button>
                </div>

                {/* Project Sync Control */}
                {currentSession?.projectName && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-bolt-elements-background-depth-3">
                    <div>
                      <div className="text-sm font-medium text-bolt-elements-textPrimary">
                        Sync for "{currentSession.projectName}"
                      </div>
                      <div className="text-xs text-bolt-elements-textSecondary mt-0.5">
                        Enable or disable sync for this specific project
                      </div>
                    </div>
                    <motion.button
                      onClick={() => {
                        const projectName = currentSession.projectName;

                        if (!projectName) {
                          return;
                        }

                        const projectInfo = syncSettings.projectFolders[projectName] || {
                          projectName,
                          folderName: currentSession.projectFolder || '',
                          lastSync: Date.now(),
                          syncEnabled: syncSettings.defaultSyncEnabled,
                        };
                        workbenchStore.toggleProjectSync(!projectInfo.syncEnabled);
                      }}
                      className={classNames(
                        'relative w-11 h-6 rounded-full transition-colors duration-200',
                        ((currentSession.projectName &&
                          syncSettings.projectFolders[currentSession.projectName]?.syncEnabled) ??
                          syncSettings.defaultSyncEnabled)
                          ? 'bg-purple-500'
                          : 'bg-bolt-elements-background-depth-4',
                      )}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <motion.div
                        className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white"
                        animate={{
                          x:
                            ((currentSession.projectName &&
                              syncSettings.projectFolders[currentSession.projectName]?.syncEnabled) ??
                            syncSettings.defaultSyncEnabled)
                              ? 20
                              : 0,
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </motion.button>
                  </div>
                )}

                {/* Auto-sync settings */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-bolt-elements-background-depth-3">
                  <div>
                    <div className="text-sm font-medium text-bolt-elements-textPrimary">Enable automatic sync</div>
                    <div className="text-xs text-bolt-elements-textSecondary mt-0.5">
                      Automatically sync files at regular intervals
                    </div>
                  </div>
                  <motion.button
                    onClick={() => handleSaveSettings({ autoSync: !syncSettings.autoSync })}
                    className={classNames(
                      'relative w-11 h-6 rounded-full transition-colors duration-200',
                      syncSettings.autoSync ? 'bg-purple-500' : 'bg-bolt-elements-background-depth-4',
                    )}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.div
                      className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white"
                      animate={{ x: syncSettings.autoSync ? 20 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </motion.button>
                </div>

                {syncSettings.autoSync && (
                  <div className="flex items-center gap-2 pl-6">
                    <div className="text-sm text-bolt-elements-textSecondary">Sync every</div>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={syncSettings.autoSyncInterval}
                      onChange={(e) =>
                        handleSaveSettings({
                          autoSyncInterval: Math.max(1, Math.min(60, parseInt(e.target.value) || 1)),
                        })
                      }
                      className={classNames(
                        'w-16 px-2 py-1 text-sm rounded-md',
                        'bg-bolt-elements-background-depth-3',
                        'text-bolt-elements-textPrimary',
                        'border border-bolt-elements-borderColor',
                        'focus:outline-none focus:ring-2 focus:ring-purple-500/20',
                      )}
                    />
                    <div className="text-sm text-bolt-elements-textSecondary">minutes</div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-bolt-elements-textPrimary">Sync on save</div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-bolt-elements-background-depth-3">
                <div>
                  <div className="text-sm font-medium text-bolt-elements-textPrimary">Sync on save</div>
                  <div className="text-xs text-bolt-elements-textSecondary mt-0.5">
                    Automatically sync files when saved
                  </div>
                </div>
                <motion.button
                  onClick={() => handleSaveSettings({ syncOnSave: !syncSettings.syncOnSave })}
                  className={classNames(
                    'relative w-11 h-6 rounded-full transition-colors duration-200',
                    syncSettings.syncOnSave ? 'bg-purple-500' : 'bg-bolt-elements-background-depth-4',
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white"
                    animate={{ x: syncSettings.syncOnSave ? 20 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Sync History */}
        <SyncStats />
      </div>
    </motion.div>
  );
}
