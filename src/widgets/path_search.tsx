import { WidgetLocation } from '@remnote/plugin-sdk';
import { usePlugin, renderWidget, useRunAsync } from '@remnote/plugin-sdk';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getFilepathsRootName,
  makePlainRichText,
  getPathFromRem,
  fuzzyMatch,
  copyToClipboard,
} from './utils';
import '../style.css';

interface SearchEntry {
  path: string;
  remId: string;
  device: string;
}

function PathSearch() {
  const plugin = usePlugin();
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useRunAsync(async () => {
    const rootName = await getFilepathsRootName(plugin);
    const root = await plugin.rem.findByName(makePlainRichText(rootName), null);
    if (!root) return [] as SearchEntry[];

    const devices = await root.getChildrenRem();
    const results: SearchEntry[] = [];

    for (const device of devices ?? []) {
      const deviceName = (await plugin.richText.toString(device.text || [])).trim();
      if (!deviceName) continue;

      const children = await device.getChildrenRem();
      for (const child of children ?? []) {
        const path = getPathFromRem(child);
        if (path) {
          results.push({ path, remId: child._id, device: deviceName });
        }
      }
    }

    return results;
  }, []) ?? [];

  const filtered = filter.length === 0
    ? entries
    : entries
        .map((e) => ({ ...e, ...fuzzyMatch(filter, e.path) }))
        .filter((e) => e.match)
        .sort((a, b) => b.score - a.score);

  // Keep selected item in view
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const item = container.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const navigateToPath = useCallback(
    async (remId: string) => {
      const rem = await plugin.rem.findOne(remId);
      if (rem) {
        await rem.openRemAsPage();
      }
      await plugin.widget.closePopup();
    },
    [plugin]
  );

  const copyPath = useCallback(
    async (path: string) => {
      const copied = await copyToClipboard(path);
      await plugin.app.toast(copied ? 'Copied to clipboard' : 'Failed to copy');
      await plugin.widget.closePopup();
    },
    [plugin]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const entry = filtered[selectedIndex];
        if (!entry) return;
        if (e.metaKey || e.ctrlKey) {
          copyPath(entry.path);
        } else {
          navigateToPath(entry.remId);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        plugin.widget.closePopup();
      }
    },
    [filtered, selectedIndex, navigateToPath, copyPath, plugin]
  );

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  return (
    <div className="p-4 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100" onKeyDown={handleKeyDown}>
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-50">Search Paths</h2>

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search paths..."
        autoFocus
        className="w-full px-3 py-2 mb-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-900 placeholder-gray-500"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          {entries.length === 0
            ? 'No paths found.'
            : 'No paths match your filter.'}
        </p>
      ) : (
        <div
          ref={listRef}
          className="max-h-64 overflow-y-auto flex flex-col gap-1 pr-1"
        >
          {filtered.map((entry, i) => (
            <button
              key={entry.remId}
              onClick={() => navigateToPath(entry.remId)}
              className={`text-left px-3 py-2 rounded-md text-sm font-mono break-all transition-colors ${
                i === selectedIndex
                  ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white'
                  : 'text-gray-900 dark:text-gray-100 border border-transparent hover:bg-gray-100 dark:hover:bg-zinc-800'
              }`}
            >
              {entry.path}
              <span className={`ml-2 text-xs font-sans ${
                i === selectedIndex
                  ? 'text-blue-200'
                  : 'text-gray-400 dark:text-gray-500'
              }`}>
                &middot; {entry.device}
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        Enter to navigate &middot; {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter to copy
      </p>
    </div>
  );
}

renderWidget(PathSearch);
