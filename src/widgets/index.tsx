import { declareIndexPlugin, ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import {
  DEVICE_NAME_STORAGE_KEY,
  DEFAULT_FILEPATH_ROOT_NAME,
  FILEPATH_ROOT_SETTING_ID,
  makePlainRichText,
  getFilepathsRootName,
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
    name: 'Filepath: Create Path',
    action: async () => {
      await plugin.widget.openPopup('path_creator');
    },
  });

  await plugin.app.registerCommand({
    id: 'set-device-name',
    name: 'Filepath: Set Device Name',
    action: async () => {
      const rootName = await getFilepathsRootName(plugin);
      await plugin.widget.openPopup('device_picker', { rootName });
    },
  });

  await plugin.app.registerCommand({
    id: 'copy-filepath',
    name: 'Filepath: Copy Path',
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
}

async function onDeactivate(_plugin: ReactRNPlugin) {
  // Clean up if needed
}

declareIndexPlugin(onActivate, onDeactivate);
