import React from 'react';
import { renderWidget, usePlugin, useTracker, AppEvents, WidgetLocation } from '@remnote/plugin-sdk';
import { isPathRem, getPathFromRem, getLastSegment, isDirectChild } from './utils';
import '../style.css';

const { useState, useEffect } = React;

function ChildPaths() {
  const plugin = usePlugin();
  const [documentId, setDocumentId] = useState<string | null>(null);

  // Fetch documentId from widget context on mount and on every navigation
  useEffect(() => {
    const fetchDocumentId = async () => {
      const ctx = await plugin.widget.getWidgetContext<WidgetLocation.DocumentBelowTitle>();
      setDocumentId(ctx?.documentId ?? null);
    };

    fetchDocumentId();
    plugin.event.addListener(AppEvents.URLChange, undefined, fetchDocumentId);
    return () => {
      plugin.event.removeListener(AppEvents.URLChange, undefined, fetchDocumentId);
    };
  }, []);

  // Reactive data fetch — re-runs when documentId changes or underlying data changes
  const children = useTracker(async (plugin) => {
    if (!documentId) return null;

    const rem = await plugin.rem.findOne(documentId);
    if (!rem) return null;

    if (!(await isPathRem(rem, plugin))) return null;

    const myPath = getPathFromRem(rem);
    if (!myPath) return null;

    const deviceRem = await rem.getParentRem();
    if (!deviceRem) return null;

    const siblings = await deviceRem.getChildrenRem();
    const result: Array<{ id: string; path: string; label: string }> = [];

    for (const sibling of siblings ?? []) {
      const sibPath = getPathFromRem(sibling);
      if (isDirectChild(myPath, sibPath)) {
        result.push({ id: sibling._id, path: sibPath, label: getLastSegment(sibPath) });
      }
    }

    return result.length > 0 ? result : null;
  }, [documentId]);

  if (!children) return null;

  const handleClick = async (id: string) => {
    const rem = await plugin.rem.findOne(id);
    if (rem) await rem.openRemAsPage();
  };

  return (
    <div className="px-2 py-2">
      <div className="text-xs font-semibold mb-1 text-gray-600 dark:text-gray-400">
        Child Paths:
      </div>
      <div className="flex flex-wrap gap-1">
        {children.map(({ id, path, label }) => (
          <button
            key={id}
            onClick={() => handleClick(id)}
            className="px-2 py-1 text-xs font-mono rounded bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-zinc-700 transition-colors"
            title={path}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

renderWidget(ChildPaths);
