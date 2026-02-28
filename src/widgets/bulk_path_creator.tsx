import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { useState, useCallback } from 'react';
import {
  DEVICE_NAME_STORAGE_KEY,
  normalizePath,
  getPathPrefixes,
  ensureFilepathsRoot,
  ensureDeviceRem,
  ensurePathRem,
  getFilepathsRootName,
  buildPathIndex,
} from './utils';
import '../style.css';

function BulkPathCreator() {
  const plugin = usePlugin();
  const [paths, setPaths] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (isCreating) return;

    const lines = paths.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      await plugin.app.toast('Please enter at least one file path');
      return;
    }

    setIsCreating(true);

    try {
      const rootName = await getFilepathsRootName(plugin);
      const root = await ensureFilepathsRoot(plugin, rootName);
      if (!root) {
        await plugin.app.toast(`Unable to create or fetch the "${rootName}" root`);
        setIsCreating(false);
        return;
      }

      const deviceName = await plugin.storage.getLocal<string>(DEVICE_NAME_STORAGE_KEY);
      if (!deviceName) {
        await plugin.app.toast('No device name set. Run "Filepath: Set Device Name" first.');
        setIsCreating(false);
        return;
      }

      const deviceRem = await ensureDeviceRem(plugin, root, deviceName);
      if (!deviceRem) {
        await plugin.app.toast('Unable to create or fetch the device Rem');
        setIsCreating(false);
        return;
      }

      let createLinks = true;
      try {
        const setting = await plugin.settings.getSetting<boolean>(`device-links-${deviceName}`);
        createLinks = setting !== false;
      } catch (_) {
        // Setting may not be registered
      }

      const index = await buildPathIndex(deviceRem);

      // Collect all unique prefixes across all valid paths
      const allPrefixes = new Set<string>();
      let skipped = 0;

      for (const line of lines) {
        const { path: normalizedPath, absolute } = normalizePath(line);
        if (!normalizedPath || !absolute) {
          skipped++;
          continue;
        }
        for (const prefix of getPathPrefixes(normalizedPath)) {
          allPrefixes.add(prefix);
        }
      }

      // Create all unique path Rems
      let created = 0;
      for (const prefix of allPrefixes) {
        if (!index.has(prefix)) {
          const pathRem = await ensurePathRem(deviceRem, prefix, createLinks, plugin, index);
          if (pathRem) created++;
        }
      }

      await plugin.widget.closePopup();

      const parts: string[] = [];
      if (created > 0) parts.push(`Created ${created} path${created !== 1 ? 's' : ''}`);
      if (skipped > 0) parts.push(`skipped ${skipped} invalid`);
      if (created === 0 && skipped === 0) parts.push('All paths already exist');
      await plugin.app.toast(parts.join(', '));
    } catch (error) {
      await plugin.app.toast('Error creating paths');
      console.error(error);
      setIsCreating(false);
    }
  }, [paths, isCreating, plugin]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        plugin.widget.closePopup();
      }
    },
    [plugin]
  );

  return (
    <div className="p-4 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100">
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-50">Bulk Create Paths</h2>

      <textarea
        value={paths}
        onChange={(e) => setPaths(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste paths, one per line..."
        autoFocus
        disabled={isCreating}
        rows={8}
        className="w-full px-3 py-2 mb-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-900 placeholder-gray-500 disabled:opacity-50 resize-y"
      />

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => plugin.widget.closePopup()}
          disabled={isCreating}
          className="px-4 py-2 rounded text-sm border border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={isCreating || paths.trim().length === 0}
          className="px-4 py-2 rounded text-sm bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCreating ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  );
}

renderWidget(BulkPathCreator);
