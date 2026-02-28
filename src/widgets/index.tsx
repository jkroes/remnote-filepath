import { declareIndexPlugin, ReactRNPlugin } from '@remnote/plugin-sdk';

const DEFAULT_PATH_TAG_NAME = 'path';
const DEFAULT_FILEPATH_ROOT_NAME = 'Filepaths';
const PATH_TAG_SETTING_ID = 'path-tag-name';
const FILEPATH_ROOT_SETTING_ID = 'filepath-root-name';
const WINDOWS_DRIVE_SEGMENT_REGEX = /^[a-zA-Z]:$/;
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

async function hasPathTag(rem: any, pathTagId: string) {
  const tagRems = await rem.getTagRems();
  return tagRems?.some((tag: any) => tag._id === pathTagId) ?? false;
}

async function collectTaggedSegments(
  rem: any,
  pathTagId: string,
  plugin: ReactRNPlugin
) {
  const segments: string[] = [];
  let current: any | undefined = rem;

  while (current) {
    if (await hasPathTag(current, pathTagId)) {
      const text = await plugin.richText.toString(current.text);
      const trimmed = text.trim();
      if (trimmed.length > 0) {
        segments.unshift(trimmed);
      }
    }

    current = await current.getParentRem();
  }

  return segments;
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
  absolute = true
) {
  const trimmed = displayText.trim();
  if (trimmed.length === 0 || segments.length === 0) {
    return;
  }

  if (!(await hasPathTag(rem, pathTag._id))) {
    await rem.addTag(pathTag);
  }

  const fileUrl =
    buildFileUrlFromSegments(segments, absolute) ?? `file://${trimmed}`;

  await rem.setText(buildLinkRichText(trimmed, fileUrl));
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

  await plugin.app.registerCommand({
    id: 'path-to-hierarchy',
    name: 'Create Path Hierarchy',
    action: async () => {
      const focusedRem = await plugin.focus.getFocusedRem();
      
      if (!focusedRem) {
        await plugin.app.toast('No rem is currently focused');
        return;
      }
      
      const remText = focusedRem.text;
      
      if (!remText || remText.length === 0) {
        await plugin.app.toast('The focused rem has no text');
        return;
      }
      
      const textString = await plugin.richText.toString(remText);
      const trimmedPath = textString.trim();
      
      if (trimmedPath.length === 0) {
        await plugin.app.toast('The focused rem has no text content');
        return;
      }
      
      const { segments, absolute } = parsePathSegments(trimmedPath);
      
      if (segments.length === 0) {
        await plugin.app.toast('Provide a valid file path to expand');
        return;
      }
      
      const pathTagName = await getPathTagName(plugin);
      const pathTag = await ensurePathTag(plugin, pathTagName);
      if (!pathTag) {
        await plugin.app.toast(`Unable to create or fetch the "${pathTagName}" tag`);
        return;
      }
      
      const rootName = await getFilepathsRootName(plugin);
      const root = await ensureFilepathsRoot(plugin, rootName);
      if (!root) {
        await plugin.app.toast(`Unable to create or fetch the "${rootName}" root`);
        return;
      }
      
      let currentParent: any = root;
      const accumulatedSegments: string[] = [];
      
      for (const rawSegment of segments) {
        const segment = rawSegment.trim();
        if (segment.length === 0) {
          continue;
        }
        
        accumulatedSegments.push(segment);
        
        let child =
          await findChildPathRem(currentParent, segment, pathTag._id, plugin);
        
        if (!child) {
          child = await createChildPathRem(currentParent, segment, plugin);
          if (!child) {
            await plugin.app.toast('Unable to create a rem for part of the path');
            return;
          }
        }
        
        await ensureRemTaggedAndLinked(
          child,
          segment,
          [...accumulatedSegments],
          pathTag,
          absolute
        );
        currentParent = child;
      }
      
      await focusedRem.remove();
      await plugin.app.toast(`Created path hierarchy under "${rootName}"`);
    },
  });
}

async function onDeactivate(_plugin: ReactRNPlugin) {
  // Clean up if needed
}

declareIndexPlugin(onActivate, onDeactivate);
