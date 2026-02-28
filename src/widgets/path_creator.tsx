import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { useState, useCallback } from 'react';
import { buildPathStringFromSegments } from './utils';
import '../style.css';

const DEFAULT_PATH_TAG_NAME = 'path';
const DEFAULT_FILEPATH_ROOT_NAME = 'Filepaths';
const PATH_TAG_SETTING_ID = 'path-tag-name';
const FILEPATH_ROOT_SETTING_ID = 'filepath-root-name';
const DEVICE_NAME_STORAGE_KEY = 'device-name';
const WINDOWS_DRIVE_PREFIX_REGEX = /^\/?([a-zA-Z]:)(?:\/|$)/;
const FILE_PROTOCOL_REGEX = /^file:\/\//i;
const BACKSLASH_REGEX = /\\/g;
const WINDOWS_DRIVE_SEGMENT_REGEX = /^[a-zA-Z]:$/;

const makePlainRichText = (text: string) => [
  {
    i: 'm' as const,
    text,
  },
];

const buildLinkRichText = (text: string, url: string) => [
  {
    i: 'm' as const,
    text,
    iUrl: url,
  },
];

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

function PathCreator() {
  const plugin = usePlugin();
  const [path, setPath] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const getConfiguredString = async (settingId: string, fallback: string) => {
    const value = await plugin.settings.getSetting<string>(settingId);
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : fallback;
  };

  const getPathTagName = () =>
    getConfiguredString(PATH_TAG_SETTING_ID, DEFAULT_PATH_TAG_NAME);

  const getFilepathsRootName = () =>
    getConfiguredString(FILEPATH_ROOT_SETTING_ID, DEFAULT_FILEPATH_ROOT_NAME);

  const ensurePathTag = async (tagName: string) => {
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
  };

  const ensureFilepathsRoot = async (rootName: string) => {
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
  };

  const ensureDeviceRem = async (root: any, deviceName: string) => {
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
  };

  const hasPathTag = async (rem: any, pathTagId: string) => {
    const tagRems = await rem.getTagRems();
    return tagRems?.some((tag: any) => tag._id === pathTagId) ?? false;
  };

  const ensureRemTaggedAndLinked = async (
    rem: any,
    displayText: string,
    segments: string[],
    pathTag: any,
    absolute = true,
    createLinks = true
  ) => {
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
  };

  const findChildPathRem = async (
    parent: any,
    segment: string,
    pathTagId: string
  ) => {
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
  };

  const createChildPathRem = async (parent: any, segment: string) => {
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
  };

  const copyToClipboard = async (text: string) => {
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
  };

  const handleCreate = useCallback(async () => {
    if (isCreating) return;

    const trimmedPath = path.trim();
    if (trimmedPath.length === 0) {
      await plugin.app.toast('Please enter a file path');
      return;
    }

    setIsCreating(true);

    try {
      const { segments, absolute } = parsePathSegments(trimmedPath);

      if (segments.length === 0) {
        await plugin.app.toast('Provide a valid file path');
        setIsCreating(false);
        return;
      }

      const pathTagName = await getPathTagName();
      const pathTag = await ensurePathTag(pathTagName);
      if (!pathTag) {
        await plugin.app.toast(`Unable to create or fetch the "${pathTagName}" tag`);
        setIsCreating(false);
        return;
      }

      const rootName = await getFilepathsRootName();
      const root = await ensureFilepathsRoot(rootName);
      if (!root) {
        await plugin.app.toast(`Unable to create or fetch the "${rootName}" root`);
        setIsCreating(false);
        return;
      }

      const deviceName = await plugin.storage.getLocal<string>(DEVICE_NAME_STORAGE_KEY);
      if (!deviceName) {
        await plugin.app.toast('No device name set. Run "Filepath: Set Device Name" first.');
        setIsCreating(false);
        return;
      }

      const deviceRem = await ensureDeviceRem(root, deviceName);
      if (!deviceRem) {
        await plugin.app.toast('Unable to create or fetch the device Rem');
        setIsCreating(false);
        return;
      }

      const createLinks = await plugin.settings.getSetting<boolean>(`device-links-${deviceName}`) !== false;

      let currentParent: any = deviceRem;
      const accumulatedSegments: string[] = [];

      for (const rawSegment of segments) {
        const segment = rawSegment.trim();
        if (segment.length === 0) {
          continue;
        }

        accumulatedSegments.push(segment);

        let child = await findChildPathRem(currentParent, segment, pathTag._id);

        if (!child) {
          child = await createChildPathRem(currentParent, segment);
          if (!child) {
            await plugin.app.toast('Unable to create a rem for part of the path');
            setIsCreating(false);
            return;
          }
        }

        await ensureRemTaggedAndLinked(
          child,
          segment,
          [...accumulatedSegments],
          pathTag,
          absolute,
          createLinks
        );
        currentParent = child;
      }

      // Copy the constructed filepath to clipboard
      const finalPath = buildPathStringFromSegments(segments, absolute);
      const copied = await copyToClipboard(finalPath);

      await plugin.widget.closePopup();
      await plugin.app.toast(
        copied
          ? `Created path and copied to clipboard: ${finalPath}`
          : `Created path hierarchy under "${rootName} > ${deviceName}"`
      );
    } catch (error) {
      await plugin.app.toast('Error creating path hierarchy');
      console.error(error);
      setIsCreating(false);
    }
  }, [path, isCreating, plugin]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isCreating) {
        e.preventDefault();
        handleCreate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        plugin.widget.closePopup();
      }
    },
    [handleCreate, isCreating, plugin]
  );

  return (
    <div className="p-4 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100">
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-50">Create Path</h2>

      <input
        type="text"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter or paste a file path..."
        autoFocus
        disabled={isCreating}
        className="w-full px-3 py-2 mb-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50"
      />

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => plugin.widget.closePopup()}
          disabled={isCreating}
          className="px-4 py-2 rounded text-sm border border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={isCreating || path.trim().length === 0}
          className="px-4 py-2 rounded text-sm bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCreating ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  );
}

renderWidget(PathCreator);
