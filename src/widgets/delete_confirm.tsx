import { renderWidget, usePlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { useState, useCallback, useEffect } from 'react';
import '../style.css';

function DeleteConfirm() {
  const plugin = usePlugin();
  const [isDeleting, setIsDeleting] = useState(false);
  const [contextData, setContextData] = useState<{
    path: string;
    descendantCount: number;
    remIds: string[];
    parentRemId: string | null;
    deviceRemId: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const ctx = await plugin.widget.getWidgetContext<WidgetLocation.Popup>();
      setContextData(ctx?.contextData ?? null);
    })();
  }, []);

  const handleDelete = useCallback(async () => {
    if (isDeleting || !contextData) return;
    setIsDeleting(true);

    try {
      const { remIds, parentRemId, deviceRemId } = contextData;

      // Delete all Rems (pre-sorted deepest-first by the command)
      for (const id of remIds) {
        const rem = await plugin.rem.findOne(id);
        if (rem) await rem.remove();
      }

      await plugin.widget.closePopup();
      await plugin.app.toast(`Deleted ${remIds.length} path${remIds.length !== 1 ? 's' : ''}`);

      // Navigate to parent path or device Rem
      const navId = parentRemId || deviceRemId;
      if (navId) {
        const navRem = await plugin.rem.findOne(navId);
        if (navRem) await navRem.openRemAsPage();
      }
    } catch (error) {
      await plugin.app.toast('Error deleting paths');
      console.error(error);
      setIsDeleting(false);
    }
  }, [isDeleting, contextData, plugin]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        plugin.widget.closePopup();
      }
    },
    [plugin]
  );

  if (!contextData) return null;

  const { path, descendantCount } = contextData;

  return (
    <div
      className="p-4 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
      onKeyDown={handleKeyDown}
    >
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-50">Delete Path</h2>

      <p className="mb-4">
        Delete <strong className="font-mono text-sm break-all">{path}</strong>
        {descendantCount > 0 && ` and ${descendantCount} descendant${descendantCount !== 1 ? 's' : ''}`}?
      </p>

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => plugin.widget.closePopup()}
          disabled={isDeleting}
          className="px-4 py-2 rounded text-sm border border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          autoFocus
          className="px-4 py-2 rounded text-sm bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

renderWidget(DeleteConfirm);
