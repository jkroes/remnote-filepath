import React from 'react';
import { renderWidget, usePlugin, useTracker, AppEvents, WidgetLocation } from '@remnote/plugin-sdk';
import { isPathRem, getPathFromRem, getLastSegment, isDirectChild, findExistingPathRem, getPathPrefixes, copyToClipboard } from './utils';
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
  const data = useTracker(async (plugin) => {
    if (!documentId) return null;

    const rem = await plugin.rem.findOne(documentId);
    if (!rem) return null;

    if (!(await isPathRem(rem, plugin))) return null;

    const myPath = getPathFromRem(rem);
    if (!myPath) return null;

    const deviceRem = await rem.getParentRem();
    if (!deviceRem) return null;

    // Compute breadcrumbs from ancestor prefixes
    const prefixes = getPathPrefixes(myPath);
    // Remove last entry (current path) — those are ancestors only
    const ancestorPrefixes = prefixes.slice(0, -1);
    const breadcrumbs: Array<{ id: string | null; label: string }> = [];
    for (const prefix of ancestorPrefixes) {
      const ancestorRem = await findExistingPathRem(deviceRem, prefix);
      breadcrumbs.push({
        id: ancestorRem?._id ?? null,
        label: getLastSegment(prefix) || prefix,
      });
    }

    // Compute children
    const siblings = await deviceRem.getChildrenRem();
    const result: Array<{ id: string; path: string; label: string }> = [];

    for (const sibling of siblings ?? []) {
      const sibPath = getPathFromRem(sibling);
      if (isDirectChild(myPath, sibPath)) {
        result.push({ id: sibling._id, path: sibPath, label: getLastSegment(sibPath) });
      }
    }

    return { breadcrumbs, children: result.length > 0 ? result : null, myPath };
  }, [documentId]);

  if (!data) return null;
  const { breadcrumbs, children, myPath } = data;

  const handleClick = async (id: string) => {
    const rem = await plugin.rem.findOne(id);
    if (rem) await rem.openRemAsPage();
  };

  const handleCopy = async () => {
    const copied = await copyToClipboard(myPath);
    await plugin.app.toast(copied ? 'Copied to clipboard' : 'Failed to copy');
  };

  return (
    <div className="px-2 py-2">
      {/* Breadcrumb row + copy button */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 min-w-0 overflow-hidden">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">&gt;</span>}
              {crumb.id ? (
                <button
                  onClick={() => handleClick(crumb.id!)}
                  className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate transition-colors"
                  title={crumb.label}
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="truncate">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 ml-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          title="Copy path to clipboard"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
            <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
          </svg>
        </button>
      </div>

      {/* Child paths — only if children exist */}
      {children && (
        <>
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
        </>
      )}
    </div>
  );
}

renderWidget(ChildPaths);
