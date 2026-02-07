import { WidgetLocation } from '@remnote/plugin-sdk';
import { usePlugin, renderWidget, useRunAsync } from '@remnote/plugin-sdk';
import { useState, useEffect, useRef, useCallback } from 'react';
import { hasPathTag, collectTaggedSegments, buildPathStringFromSegments } from './utils';
import '../style.css';

interface FilepathEntry {
  path: string;
  remId: string;
}

function FilepathCopier() {
  const plugin = usePlugin();
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const data = useRunAsync(async () => {
    const ctx = await plugin.widget.getWidgetContext<WidgetLocation.Popup>();
    const docRemId = ctx?.contextData?.docRemId as string | undefined;
    const focusedRemId = ctx?.contextData?.focusedRemId as string | null;
    const pathTagId = ctx?.contextData?.pathTagId as string | undefined;
    if (!docRemId || !pathTagId) return { entries: [] as FilepathEntry[], focusedRemId: null };

    const docRem = await plugin.rem.findOne(docRemId);
    if (!docRem) return { entries: [] as FilepathEntry[], focusedRemId };

    const descendants = await docRem.getDescendants();
    const allRems = [docRem, ...(descendants ?? [])];
    const entries: FilepathEntry[] = [];
    const seen = new Set<string>();

    for (const rem of allRems) {
      if (!rem.text || !Array.isArray(rem.text)) continue;

      for (const element of rem.text) {
        if (typeof element === 'string' || element?.i !== 'q' || !element?._id) continue;

        try {
          const referencedRem = await plugin.rem.findOne(element._id);
          if (!referencedRem) continue;
          if (!(await hasPathTag(referencedRem, pathTagId))) continue;

          const segments = await collectTaggedSegments(referencedRem, pathTagId, plugin);
          if (segments.length === 0) continue;

          const path = buildPathStringFromSegments(segments, true);
          if (path && !seen.has(path)) {
            seen.add(path);
            entries.push({ path, remId: rem._id });
          }
        } catch (_) {
          // Skip references that can't be resolved
        }
      }
    }

    return { entries, focusedRemId };
  }, []);

  const entries = data?.entries ?? [];
  const focusedRemId = data?.focusedRemId ?? null;

  const filtered = entries.filter((e) =>
    e.path.toLowerCase().includes(filter.toLowerCase())
  );

  // Determine preselected index based on focused Rem
  useEffect(() => {
    if (!focusedRemId || filtered.length === 0) {
      setSelectedIndex(0);
      return;
    }
    const idx = filtered.findIndex((e) => e.remId === focusedRemId);
    setSelectedIndex(idx >= 0 ? idx : 0);
  }, [focusedRemId, filtered.length]);

  // Keep selected item in view
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const item = container.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const copyAndClose = useCallback(
    async (path: string) => {
      let copied = false;
      try {
        await navigator.clipboard.writeText(path);
        copied = true;
      } catch (_) {
        // Clipboard API blocked by iframe permissions policy; use execCommand fallback
        const textarea = document.createElement('textarea');
        textarea.value = path;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      }
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
        if (filtered[selectedIndex]) {
          copyAndClose(filtered[selectedIndex].path);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        plugin.widget.closePopup();
      }
    },
    [filtered, selectedIndex, copyAndClose, plugin]
  );

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  return (
    <div className="p-4 text-gray-900 bg-white" onKeyDown={handleKeyDown}>
      <h2 className="text-lg font-semibold mb-2 text-gray-800">Copy Filepath</h2>

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter paths..."
        autoFocus
        className="w-full px-3 py-2 mb-3 border border-gray-300 rounded focus:outline-none focus:border-blue-400"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">
          {entries.length === 0
            ? 'No path references found in this document.'
            : 'No filepaths match your filter.'}
        </p>
      ) : (
        <div
          ref={listRef}
          className="max-h-64 overflow-y-auto flex flex-col gap-1"
        >
          {filtered.map((entry, i) => (
            <button
              key={entry.path}
              onClick={() => copyAndClose(entry.path)}
              className={`text-left px-3 py-2 rounded text-sm font-mono break-all transition-colors ${
                i === selectedIndex
                  ? 'bg-blue-100 border border-blue-400'
                  : 'border border-gray-200 hover:bg-blue-50 hover:border-blue-300'
              }`}
            >
              {entry.path}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

renderWidget(FilepathCopier);
