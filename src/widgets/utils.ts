import type { RNPlugin } from '@remnote/plugin-sdk';

// Constants
export const DEVICE_NAME_STORAGE_KEY = 'device-name';
export const DEFAULT_FILEPATH_ROOT_NAME = 'Filepaths';
export const FILEPATH_ROOT_SETTING_ID = 'filepath-root-name';

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
    const text = (await plugin.richText.toString(child.text || [])).trim();
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

// Path helpers
export function normalizePath(rawInput: string): { path: string; absolute: boolean } {
  let path = rawInput.trim();
  if (path.length === 0) return { path: '', absolute: false };

  // Strip file:// prefix
  path = path.replace(/^file:\/\//i, '');

  // Normalize backslashes
  path = path.replace(/\\/g, '/');

  // Strip trailing slashes (but not a bare "/" or "C:/")
  path = path.replace(/\/+$/, '');
  if (path.length === 0) path = '/';

  // Check for /C:/ pattern (from file:///C:/...)
  if (/^\/[a-zA-Z]:/.test(path)) {
    path = path.slice(1);
    return { path, absolute: true };
  }

  // Windows drive letter
  if (/^[a-zA-Z]:/.test(path)) {
    return { path, absolute: true };
  }

  // UNC path (//server/share)
  if (path.startsWith('//')) {
    return { path, absolute: true };
  }

  // Unix absolute
  if (path.startsWith('/')) {
    return { path, absolute: true };
  }

  // Relative
  return { path, absolute: false };
}

export function toFileUrl(path: string): string {
  // Bare Windows drive: C: → file:///C:/
  if (/^[a-zA-Z]:$/.test(path)) {
    return `file:///${path}/`;
  }
  // Windows drive with path: C:/Users → file:///C:/Users
  if (/^[a-zA-Z]:/.test(path)) {
    return `file:///${path}`;
  }
  // UNC path: //server/share → file://server/share
  if (path.startsWith('//')) {
    return `file:${path}`;
  }
  // Unix (path already has leading /) or relative
  return `file://${path}`;
}

export function getPathPrefixes(path: string): string[] {
  if (path.length === 0) return [];

  const prefixes: string[] = [];

  // For UNC paths (//server/share/...), skip past //server to start scanning
  // The first meaningful prefix is //server/share
  let start = 1;
  if (path.startsWith('//')) {
    const serverSlash = path.indexOf('/', 2);
    start = serverSlash >= 0 ? serverSlash + 1 : path.length;
  }

  // Find each / and take the substring up to that point
  for (let i = start; i < path.length; i++) {
    if (path[i] === '/') {
      prefixes.push(path.slice(0, i));
    }
  }

  // Always include the full path itself
  prefixes.push(path);

  return prefixes;
}

// Structural helpers
export async function isPathRem(rem: any, plugin: RNPlugin): Promise<boolean> {
  const parent = await rem.getParentRem();
  if (!parent) return false;
  const grandparent = await parent.getParentRem();
  if (!grandparent) return false;
  const rootName = await getFilepathsRootName(plugin);
  const grandparentText = (await plugin.richText.toString(grandparent.text || [])).trim();
  return grandparentText === rootName;
}

export function getPathFromRem(rem: any): string {
  return extractTextFromRichText(rem.text).trim();
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

export async function buildPathIndex(deviceRem: any): Promise<Map<string, any>> {
  const index = new Map<string, any>();
  const children = await deviceRem.getChildrenRem();
  for (const child of children ?? []) {
    const path = getPathFromRem(child);
    if (path) {
      index.set(path, child);
    }
  }
  return index;
}

export function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  let qi = 0;
  let score = 0;
  let lastMatchIndex = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1;
      if (lastMatchIndex === ti - 1) score += 2;
      if (ti === 0 || t[ti - 1] === '/') score += 3;
      lastMatchIndex = ti;
      qi++;
    }
  }

  return { match: qi === q.length, score };
}

export async function findExistingPathRem(
  deviceRem: any,
  fullPath: string,
  index?: Map<string, any>,
) {
  if (index) {
    return index.get(fullPath) ?? undefined;
  }
  const children = await deviceRem.getChildrenRem();
  for (const child of children ?? []) {
    const childPath = getPathFromRem(child);
    if (childPath === fullPath) {
      return child;
    }
  }
  return undefined;
}

export async function ensurePathRem(
  deviceRem: any,
  fullPath: string,
  createLinks: boolean,
  plugin: RNPlugin,
  index?: Map<string, any>,
) {
  // Check if it already exists
  const existing = await findExistingPathRem(deviceRem, fullPath, index);
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

  // Set text (full path as link or plain text)
  if (createLinks) {
    const fileUrl = toFileUrl(fullPath);
    await newRem.setText(buildLinkRichText(fullPath, fileUrl));
  } else {
    await newRem.setText(makePlainRichText(fullPath));
  }

  // Update index so subsequent lookups in the same operation find this Rem
  if (index) {
    index.set(fullPath, newRem);
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

