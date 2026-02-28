import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { useState, useCallback } from 'react';
import {
  DEVICE_NAME_STORAGE_KEY,
  parsePathSegments,
  ensureFilepathsRoot,
  ensureDeviceRem,
  ensureSegmentRem,
  getFilepathsRootName,
  copyToClipboard,
  buildPathStringFromSegments,
} from './utils';
import '../style.css';

function PathCreator() {
  const plugin = usePlugin();
  const [path, setPath] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (isCreating) return;

    const trimmedPath = path.trim();
    if (trimmedPath.length === 0) {
      await plugin.app.toast('Please enter a file path');
      return;
    }

    setIsCreating(true);

    try {
      const { segments, absolute } = parsePathSegments(trimmedPath);

      if (segments.length === 0) {
        await plugin.app.toast('Provide a valid file path');
        setIsCreating(false);
        return;
      }

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

      const createLinks = await plugin.settings.getSetting<boolean>(`device-links-${deviceName}`) !== false;

      // Create flat Rems for each accumulated path
      const accumulatedSegments: string[] = [];

      for (const rawSegment of segments) {
        const segment = rawSegment.trim();
        if (segment.length === 0) {
          continue;
        }

        accumulatedSegments.push(segment);

        // Build the full path for this level
        const fullPath = buildPathStringFromSegments(accumulatedSegments, absolute);

        // Create or reuse the Rem
        const segmentRem = await ensureSegmentRem(
          deviceRem,
          fullPath,
          absolute,
          createLinks,
          plugin
        );

        if (!segmentRem) {
          await plugin.app.toast('Unable to create a rem for part of the path');
          setIsCreating(false);
          return;
        }
      }

      // Copy the constructed filepath to clipboard
      const finalPath = buildPathStringFromSegments(segments, absolute);
      const copied = await copyToClipboard(finalPath);

      await plugin.widget.closePopup();
      await plugin.app.toast(
        copied
          ? `Created path and copied to clipboard: ${finalPath}`
          : `Created path hierarchy under "${rootName} > ${deviceName}"`
      );
    } catch (error) {
      await plugin.app.toast('Error creating path hierarchy');
      console.error(error);
      setIsCreating(false);
    }
  }, [path, isCreating, plugin]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isCreating) {
        e.preventDefault();
        handleCreate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        plugin.widget.closePopup();
      }
    },
    [handleCreate, isCreating, plugin]
  );

  return (
    <div className="p-4 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100">
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-50">Create Path</h2>

      <input
        type="text"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter or paste a file path..."
        autoFocus
        disabled={isCreating}
        className="w-full px-3 py-2 mb-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50"
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
          disabled={isCreating || path.trim().length === 0}
          className="px-4 py-2 rounded text-sm bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCreating ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  );
}

renderWidget(PathCreator);
