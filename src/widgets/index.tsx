import { declareIndexPlugin, ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { hasPathTag, WINDOWS_DRIVE_SEGMENT_REGEX } from './utils';

const DEFAULT_PATH_TAG_NAME = 'path';
const DEFAULT_FILEPATH_ROOT_NAME = 'Filepaths';
const PATH_TAG_SETTING_ID = 'path-tag-name';
const FILEPATH_ROOT_SETTING_ID = 'filepath-root-name';
const DEVICE_NAME_STORAGE_KEY = 'device-name';
const WINDOWS_DRIVE_PREFIX_REGEX = /^\/?([a-zA-Z]:)(?:\/|$)/;
const FILE_PROTOCOL_REGEX = /^file:\/\//i;
const BACKSLASH_REGEX = /\\/g;

const makePlainRichText = (text: string) => [
  {
    i: 'm' as const,
    text,
  },
];

const getConfiguredString = async (
  plugin: ReactRNPlugin,
  settingId: string,
  fallback: string
) => {
  const value = await plugin.settings.getSetting<string>(settingId);
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
};

const getPathTagName = (plugin: ReactRNPlugin) =>
  getConfiguredString(plugin, PATH_TAG_SETTING_ID, DEFAULT_PATH_TAG_NAME);

const getFilepathsRootName = (plugin: ReactRNPlugin) =>
  getConfiguredString(plugin, FILEPATH_ROOT_SETTING_ID, DEFAULT_FILEPATH_ROOT_NAME);

async function ensurePathTag(plugin: ReactRNPlugin, tagName: string) {
  const nameRichText = makePlainRichText(tagName);
  const existing = await plugin.rem.findByName(nameRichText, null);

  if (existing) {
    return existing;
  }

  const newTag = await plugin.rem.createRem();
  if (!newTag) {
    return undefined;
  }

  await newTag.setText(nameRichText);
  return newTag;
}

async function ensureFilepathsRoot(plugin: ReactRNPlugin, rootName: string) {
  const nameRichText = makePlainRichText(rootName);
  const existing = await plugin.rem.findByName(nameRichText, null);

  if (existing) {
    return existing;
  }

  const newRoot = await plugin.rem.createRem();
  if (!newRoot) {
    return undefined;
  }

  await newRoot.setText(nameRichText);
  try {
    await newRoot.setParent(null);
  } catch (_err) {
    // Scope may prevent moving to top level; leave wherever it was created.
  }
  return newRoot;
}

async function ensureDeviceRem(
  plugin: ReactRNPlugin,
  root: any,
  deviceName: string
) {
  const children = await root.getChildrenRem();
  for (const child of children ?? []) {
    const text = (await plugin.richText.toString(child.text)).trim();
    if (text === deviceName) {
      return child;
    }
  }

  const newRem = await plugin.rem.createRem();
  if (!newRem) {
    return undefined;
  }

  try {
    await newRem.setParent(root);
  } catch (_err) {
    // leave in default location if move fails
  }
  await newRem.setText(makePlainRichText(deviceName));
  return newRem;
}

const buildFileUrlFromSegments = (segments: string[], absolute = true) => {
  if (segments.length === 0) {
    return undefined;
  }

  const [first, ...rest] = segments;

  if (WINDOWS_DRIVE_SEGMENT_REGEX.test(first)) {
    const remainder = rest.join('/');
    const drivePath = remainder.length > 0 ? `${first}/${remainder}` : `${first}/`;
    return `file:///${drivePath}`;
  }

  const joined = segments.join('/');
  if (joined.length === 0) {
    return absolute ? 'file:///' : 'file://';
  }

  const prefix = absolute ? '/' : '';
  return `file://${prefix}${joined}`;
};

const buildLinkRichText = (text: string, url: string) => [
  {
    i: 'm' as const,
    text,
    iUrl: url,
  },
];

const parsePathSegments = (rawPath: string) => {
  let path = rawPath.trim();

  if (path.length === 0) {
    return { segments: [], absolute: false };
  }

  if (FILE_PROTOCOL_REGEX.test(path)) {
    path = path.replace(FILE_PROTOCOL_REGEX, '');
  }

  path = path.replace(BACKSLASH_REGEX, '/');

  let absolute = false;
  let drive: string | undefined;

  const driveMatch = path.match(WINDOWS_DRIVE_PREFIX_REGEX);
  if (driveMatch) {
    drive = driveMatch[1];
    absolute = true;
    path = path.slice(driveMatch[0].length);
  } else if (path.startsWith('/')) {
    absolute = true;
    path = path.replace(/^\/+/, '');
  }

  const parts = path
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const segments = drive ? [drive, ...parts] : parts;

  return { segments, absolute };
};

async function ensureRemTaggedAndLinked(
  rem: any,
  displayText: string,
  segments: string[],
  pathTag: any,
  absolute = true,
  createLinks = true
) {
  const trimmed = displayText.trim();
  if (trimmed.length === 0 || segments.length === 0) {
    return;
  }

  if (!(await hasPathTag(rem, pathTag._id))) {
    await rem.addTag(pathTag);
  }

  if (createLinks) {
    const fileUrl =
      buildFileUrlFromSegments(segments, absolute) ?? `file://${trimmed}`;
    await rem.setText(buildLinkRichText(trimmed, fileUrl));
  } else {
    await rem.setText(makePlainRichText(trimmed));
  }
}

async function findChildPathRem(
  parent: any,
  segment: string,
  pathTagId: string,
  plugin: ReactRNPlugin
) {
  if (!parent || !parent.getChildrenRem) {
    return undefined;
  }

  const children = await parent.getChildrenRem();
  let fallback: any | undefined;
  for (const child of children ?? []) {
    const childText = (await plugin.richText.toString(child.text)).trim();
    if (childText !== segment) {
      continue;
    }
    if (await hasPathTag(child, pathTagId)) {
      return child;
    }
    fallback = fallback ?? child;
  }

  return fallback;
}

async function createChildPathRem(
  parent: any,
  segment: string,
  plugin: ReactRNPlugin
) {
  const newRem = await plugin.rem.createRem();
  if (!newRem) {
    return undefined;
  }

  try {
    await newRem.setParent(parent);
  } catch (_err) {
    // If we can't move it, leave it in the default location.
  }
  await newRem.setText(makePlainRichText(segment));
  return newRem;
}

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerStringSetting({
    id: PATH_TAG_SETTING_ID,
    title: 'Path Tag Name',
    defaultValue: DEFAULT_PATH_TAG_NAME,
    description: 'Tag applied to every Rem that is part of a file path hierarchy.',
  });

  await plugin.settings.registerStringSetting({
    id: FILEPATH_ROOT_SETTING_ID,
    title: 'Filepaths Root Name',
    defaultValue: DEFAULT_FILEPATH_ROOT_NAME,
    description: 'Name of the top-level Rem that stores all generated file path hierarchies.',
  });

  await plugin.app.registerWidget('device_picker', WidgetLocation.Popup, {
    dimensions: { height: 'auto', width: '400px' },
  });

  await plugin.app.registerWidget('path_creator', WidgetLocation.Popup, {
    dimensions: { height: 'auto', width: '450px' },
  });

  // Register per-device link-creation toggles for existing devices
  const rootName = await getFilepathsRootName(plugin);
  const existingRoot = await plugin.rem.findByName(makePlainRichText(rootName), null);
  if (existingRoot) {
    const deviceChildren = await existingRoot.getChildrenRem();
    for (const child of deviceChildren ?? []) {
      const name = (await plugin.richText.toString(child.text)).trim();
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

  await plugin.app.registerWidget('filepath_copier', WidgetLocation.Popup, {
    dimensions: { height: 'auto', width: '500px' },
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

      const pathTagName = await getPathTagName(plugin);
      const pathTag = await plugin.rem.findByName(makePlainRichText(pathTagName), null);
      if (!pathTag) {
        await plugin.app.toast('No path tag found. Run "Create Path Hierarchy" first.');
        return;
      }

      const focusedRem = await plugin.focus.getFocusedRem();
      const focusedRemId = focusedRem?._id ?? null;
      await plugin.widget.openPopup('filepath_copier', {
        docRemId,
        focusedRemId,
        pathTagId: pathTag._id,
      });
    },
  });
}

async function onDeactivate(_plugin: ReactRNPlugin) {
  // Clean up if needed
}

declareIndexPlugin(onActivate, onDeactivate);
