import { declareIndexPlugin, ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import {
  DEVICE_NAME_STORAGE_KEY,
  DEFAULT_FILEPATH_ROOT_NAME,
  FILEPATH_ROOT_SETTING_ID,
  makePlainRichText,
  getFilepathsRootName,
  isPathRem,
  getPathFromRem,
  buildPathIndex,
  getPathPrefixes,
} from './utils';

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerStringSetting({
    id: FILEPATH_ROOT_SETTING_ID,
    title: 'Filepaths Root Name',
    defaultValue: DEFAULT_FILEPATH_ROOT_NAME,
    description: 'Name of the top-level Rem that stores all generated file path hierarchies.',
  });

  // Register child paths widget (DocumentBelowTitle — SDK provides documentId)
  await plugin.app.registerWidget('child_paths', WidgetLocation.DocumentBelowTitle, {
    dimensions: { height: 'auto', width: '100%' },
  });

  await plugin.app.registerWidget('device_picker', WidgetLocation.Popup, {
    dimensions: { height: 'auto', width: '400px' },
  });

  await plugin.app.registerWidget('path_creator', WidgetLocation.Popup, {
    dimensions: { height: 'auto', width: '450px' },
  });

  await plugin.app.registerWidget('filepath_copier', WidgetLocation.Popup, {
    dimensions: { height: 'auto', width: '500px' },
  });

  await plugin.app.registerWidget('path_search', WidgetLocation.Popup, {
    dimensions: { height: 'auto', width: '500px' },
  });

  await plugin.app.registerWidget('bulk_path_creator', WidgetLocation.Popup, {
    dimensions: { height: 'auto', width: '500px' },
  });

  await plugin.app.registerWidget('delete_confirm', WidgetLocation.Popup, {
    dimensions: { height: 'auto', width: '450px' },
  });

  // Register per-device link-creation toggles for existing devices
  const rootName = await getFilepathsRootName(plugin);
  const existingRoot = await plugin.rem.findByName(makePlainRichText(rootName), null);
  if (existingRoot) {
    const deviceChildren = await existingRoot.getChildrenRem();
    for (const child of deviceChildren ?? []) {
      const name = (await plugin.richText.toString(child.text || [])).trim();
      if (name.length > 0) {
        await plugin.settings.registerBooleanSetting({
          id: `device-links-${name}`,
          title: `Enable links for "${name}"`,
          defaultValue: true,
          description: `Create file:// links for path segments on device "${name}"`,
        });
      }
    }
  }

  await plugin.app.registerCommand({
    id: 'path-to-hierarchy',
    name: 'FP: Add Path',
    action: async () => {
      // Pre-fill: check if current document is a path Rem
      let prefillPath: string | undefined;
      const paneId = await plugin.window.getFocusedPaneId();
      const docRemId = await plugin.window.getOpenPaneRemId(paneId);
      if (docRemId) {
        const docRem = await plugin.rem.findOne(docRemId);
        if (docRem && (await isPathRem(docRem, plugin))) {
          prefillPath = getPathFromRem(docRem);
        }
      }

      // Auto-prompt: check if device name is set
      const deviceName = await plugin.storage.getLocal<string>(DEVICE_NAME_STORAGE_KEY);
      if (!deviceName) {
        const rootName = await getFilepathsRootName(plugin);
        await plugin.widget.openPopup('device_picker', {
          rootName,
          returnTo: 'path_creator',
          prefillPath,
        });
        return;
      }

      await plugin.widget.openPopup('path_creator', { prefillPath });
    },
  });

  await plugin.app.registerCommand({
    id: 'set-device-name',
    name: 'FP: Set Device',
    action: async () => {
      const rootName = await getFilepathsRootName(plugin);
      await plugin.widget.openPopup('device_picker', { rootName });
    },
  });

  await plugin.app.registerCommand({
    id: 'copy-filepath',
    name: 'FP: Copy Referenced Path',
    action: async () => {
      const paneId = await plugin.window.getFocusedPaneId();
      const docRemId = await plugin.window.getOpenPaneRemId(paneId);
      if (!docRemId) {
        await plugin.app.toast('No document is open in the focused pane');
        return;
      }

      const focusedRem = await plugin.focus.getFocusedRem();
      const focusedRemId = focusedRem?._id ?? null;
      await plugin.widget.openPopup('filepath_copier', {
        docRemId,
        focusedRemId,
      });
    },
  });

  await plugin.app.registerCommand({
    id: 'search-paths',
    name: 'FP: Search All Paths',
    action: async () => {
      await plugin.widget.openPopup('path_search');
    },
  });

  await plugin.app.registerCommand({
    id: 'bulk-create-paths',
    name: 'FP: Bulk Add Paths',
    action: async () => {
      const deviceName = await plugin.storage.getLocal<string>(DEVICE_NAME_STORAGE_KEY);
      if (!deviceName) {
        const rootName = await getFilepathsRootName(plugin);
        await plugin.widget.openPopup('device_picker', {
          rootName,
          returnTo: 'bulk_path_creator',
        });
        return;
      }
      await plugin.widget.openPopup('bulk_path_creator');
    },
  });

  await plugin.app.registerCommand({
    id: 'delete-path',
    name: 'FP: Delete This Path',
    action: async () => {
      const paneId = await plugin.window.getFocusedPaneId();
      const docRemId = await plugin.window.getOpenPaneRemId(paneId);
      if (!docRemId) {
        await plugin.app.toast('No document is open in the focused pane');
        return;
      }

      const docRem = await plugin.rem.findOne(docRemId);
      if (!docRem || !(await isPathRem(docRem, plugin))) {
        await plugin.app.toast('Current document is not a path Rem');
        return;
      }

      const myPath = getPathFromRem(docRem);
      const deviceRem = await docRem.getParentRem();
      if (!deviceRem) {
        await plugin.app.toast('Could not find device Rem');
        return;
      }

      const index = await buildPathIndex(deviceRem);

      // Find all descendants (paths starting with myPath + "/")
      const descendants: Array<{ id: string; path: string }> = [];
      for (const [path, rem] of index) {
        if (path.startsWith(myPath + '/')) {
          descendants.push({ id: rem._id, path });
        }
      }

      // Sort deepest-first for safe deletion order
      descendants.sort((a, b) => b.path.length - a.path.length);

      // All Rem IDs to delete: descendants (deepest-first) then self
      const remIds = [...descendants.map(d => d.id), docRemId];

      // Find parent path Rem for post-delete navigation
      const prefixes = getPathPrefixes(myPath);
      const parentPath = prefixes.length >= 2 ? prefixes[prefixes.length - 2] : null;
      const parentRemId = parentPath ? (index.get(parentPath)?._id ?? null) : null;

      await plugin.widget.openPopup('delete_confirm', {
        path: myPath,
        descendantCount: descendants.length,
        remIds,
        parentRemId,
        deviceRemId: deviceRem._id,
      });
    },
  });
}

async function onDeactivate(_plugin: ReactRNPlugin) {
  // Clean up if needed
}

declareIndexPlugin(onActivate, onDeactivate);
