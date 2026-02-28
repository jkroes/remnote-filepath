import { WidgetLocation, usePlugin, renderWidget, useRunAsync } from '@remnote/plugin-sdk';
import { useState } from 'react';
import { DEVICE_NAME_STORAGE_KEY } from './utils';
import '../style.css';

function DevicePicker() {
  const plugin = usePlugin();
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const existingDevices = useRunAsync(async () => {
    const ctx =
      await plugin.widget.getWidgetContext<WidgetLocation.Popup>();
    const rootName = ctx?.contextData?.rootName;
    if (!rootName) return [];

    const root = await plugin.rem.findByName(
      [{ i: 'm' as const, text: rootName }],
      null
    );
    if (!root) return [];

    const children = await root.getChildrenRem();
    if (!children) return [];

    const names: string[] = [];
    for (const child of children) {
      const text = (await plugin.richText.toString(child.text || [])).trim();
      if (text.length > 0) {
        names.push(text);
      }
    }
    return names;
  }, []);

  const selectDevice = async (name: string) => {
    const trimmed = name.trim();
    if (trimmed.length === 0 || submitting) return;
    setSubmitting(true);

    await plugin.storage.setLocal(DEVICE_NAME_STORAGE_KEY, trimmed);

    // Best-effort: register the per-device link toggle for immediate availability
    try {
      await plugin.settings.registerBooleanSetting({
        id: `device-links-${trimmed}`,
        title: `Enable links for "${trimmed}"`,
        defaultValue: true,
        description: `Create file:// links for path segments on device "${trimmed}"`,
      });
    } catch (_) {
      // SDK may not support registering settings outside onActivate
    }

    // Check if we should chain to another popup
    const ctx = await plugin.widget.getWidgetContext<WidgetLocation.Popup>();
    const returnTo = ctx?.contextData?.returnTo as string | undefined;
    if (returnTo) {
      await plugin.widget.openPopup(returnTo, {
        prefillPath: ctx?.contextData?.prefillPath,
      });
    } else {
      await plugin.widget.closePopup();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await selectDevice(newName);
  };

  return (
    <div className="p-4 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100">
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-50">Select Device Name</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Choose an existing device or enter a new name. This identifies which
        machine created the file paths.
      </p>

      {existingDevices && existingDevices.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Existing devices:</p>
          <div className="flex flex-col gap-1">
            {existingDevices.map((name) => (
              <button
                key={name}
                onClick={() => selectDevice(name)}
                disabled={submitting}
                className="text-left px-3 py-2 rounded border border-gray-200 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-zinc-800 hover:border-blue-300 dark:hover:border-blue-500 transition-colors disabled:opacity-50 text-gray-900 dark:text-gray-100"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label className="text-sm font-medium mb-1 block text-gray-900 dark:text-gray-100">
          New device name:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                plugin.widget.closePopup();
              }
            }}
            placeholder="e.g. MacBook, WorkPC"
            autoFocus
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-gray-900 placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={newName.trim().length === 0 || submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Set
          </button>
        </div>
      </form>
    </div>
  );
}

renderWidget(DevicePicker);
