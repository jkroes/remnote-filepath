import type { RNPlugin } from '@remnote/plugin-sdk';

// Constants
export const DEVICE_NAME_STORAGE_KEY = 'device-name';
export const DEFAULT_FILEPATH_ROOT_NAME = 'Filepaths';
export const FILEPATH_ROOT_SETTING_ID = 'filepath-root-name';
export const FILEPATH_SEGMENT_POWERUP = 'filepath_segment';

export const WINDOWS_DRIVE_SEGMENT_REGEX = /^[a-zA-Z]:$/;
const WINDOWS_DRIVE_PREFIX_REGEX = /^\/?([a-zA-Z]:)(?:\/|$)/;
const FILE_PROTOCOL_REGEX = /^file:\/\//i;
const BACKSLASH_REGEX = /\\/g;

// Rich text helpers
export const makePlainRichText = (text: string) => [
  {
    i: 'm' as const,
    text,
  },
];

export const buildLinkRichText = (text: string, url: string) => [
  {
    i: 'm' as const,
    text,
    iUrl: url,
  },
];

function extractTextFromRichText(richText: any): string {
  if (!Array.isArray(richText)) return '';
  return richText.map((el: any) => {
    if (typeof el === 'string') return el;
    return el?.text ?? '';
  }).join('');
}

// Settings helpers
export const getConfiguredString = async (
  plugin: RNPlugin,
  settingId: string,
  fallback: string
) => {
  const value = await plugin.settings.getSetting<string>(settingId);
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
};

export const getFilepathsRootName = (plugin: RNPlugin) =>
  getConfiguredString(plugin, FILEPATH_ROOT_SETTING_ID, DEFAULT_FILEPATH_ROOT_NAME);

// Rem helpers
export async function ensureFilepathsRoot(plugin: RNPlugin, rootName: string) {
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

export async function ensureDeviceRem(
  plugin: RNPlugin,
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

// Path parsing
export function parsePathSegments(rawPath: string) {
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
}

export function buildFileUrlFromSegments(segments: string[], absolute = true) {
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
}

// Powerup-based helpers
export async function isPathSegment(rem: any) {
  return await rem.hasPowerup(FILEPATH_SEGMENT_POWERUP);
}

export function getPathFromRem(rem: any): string {
  return extractTextFromRichText(rem.text);
}

export function getLastSegment(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length === 0) return '';

  const parts = trimmed.split('/').filter(p => p.length > 0);
  return parts[parts.length - 1] || '';
}

export function isDirectChild(parentPath: string, childPath: string): boolean {
  const parent = parentPath.trim();
  const child = childPath.trim();

  if (!child.startsWith(parent + '/')) return false;

  const remainder = child.slice(parent.length + 1);
  return remainder.length > 0 && !remainder.includes('/');
}

export async function findExistingPathRem(
  deviceRem: any,
  fullPath: string,
  plugin: RNPlugin
) {
  const children = await deviceRem.getChildrenRem();
  for (const child of children ?? []) {
    if (!(await isPathSegment(child))) continue;
    const childPath = getPathFromRem(child);
    if (childPath === fullPath) {
      return child;
    }
  }
  return undefined;
}

export async function ensureSegmentRem(
  deviceRem: any,
  fullPath: string,
  absolute: boolean,
  createLinks: boolean,
  plugin: RNPlugin
) {
  // Check if it already exists
  const existing = await findExistingPathRem(deviceRem, fullPath, plugin);
  if (existing) {
    return existing;
  }

  // Create new Rem
  const newRem = await plugin.rem.createRem();
  if (!newRem) {
    return undefined;
  }

  try {
    await newRem.setParent(deviceRem);
  } catch (_err) {
    // leave in default location if move fails
  }

  // Add powerup
  await newRem.addPowerup(FILEPATH_SEGMENT_POWERUP);

  // Set text (full path as link or plain text)
  if (createLinks) {
    const { segments } = parsePathSegments(fullPath);
    const fileUrl = buildFileUrlFromSegments(segments, absolute) ?? `file://${fullPath}`;
    await newRem.setText(buildLinkRichText(fullPath, fileUrl));
  } else {
    await newRem.setText(makePlainRichText(fullPath));
  }

  return newRem;
}

// Clipboard helper
export async function copyToClipboard(text: string): Promise<boolean> {
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch (_) {
    // Clipboard API blocked by iframe permissions policy; use execCommand fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    copied = document.execCommand('copy');
    document.body.removeChild(textarea);
  }
  return copied;
}

// OLD FUNCTIONS - kept for backwards compatibility during migration
export async function hasPathTag(rem: any, pathTagId: string) {
  const tagRems = await rem.getTagRems();
  return tagRems?.some((tag: any) => tag._id === pathTagId) ?? false;
}

export async function collectTaggedSegments(
  rem: any,
  pathTagId: string,
  _plugin?: any
) {
  const segments: string[] = [];
  let current: any | undefined = rem;

  while (current) {
    if (await hasPathTag(current, pathTagId)) {
      const trimmed = extractTextFromRichText(current.text).trim();
      if (trimmed.length > 0) {
        segments.unshift(trimmed);
      }
    }

    current = await current.getParentRem();
  }

  return segments;
}

export function buildPathStringFromSegments(segments: string[], absolute = true) {
  if (segments.length === 0) {
    return '';
  }

  const [first, ...rest] = segments;

  if (WINDOWS_DRIVE_SEGMENT_REGEX.test(first)) {
    const remainder = rest.join('/');
    return remainder.length > 0 ? `${first}/${remainder}` : `${first}/`;
  }

  const joined = segments.join('/');
  const prefix = absolute ? '/' : '';
  return `${prefix}${joined}`;
}
