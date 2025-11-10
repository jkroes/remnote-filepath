import { declareIndexPlugin, ReactRNPlugin } from '@remnote/plugin-sdk';

const PATH_TAG_NAME = 'path';
const WINDOWS_DRIVE_REGEX = /^[a-zA-Z]:$/;

const makePlainRichText = (text: string) => [
  {
    i: 'm' as const,
    text,
  },
];

async function ensurePathTag(plugin: ReactRNPlugin) {
  const nameRichText = makePlainRichText(PATH_TAG_NAME);
  const existing = await plugin.rem.findByName(nameRichText, null);
  
  if (existing) {
    return existing;
  }
  
  const newTag = await plugin.rem.createRem();
  if (!newTag) {
    return undefined;
  }
  
  await newTag.setText(nameRichText);
  await newTag.setParent(null);
  return newTag;
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

const buildFileUrlFromSegments = (segments: string[]) => {
  if (segments.length === 0) {
    return undefined;
  }

  const [first, ...rest] = segments;

  if (WINDOWS_DRIVE_REGEX.test(first)) {
    const remainder = rest.join('/');
    const drivePath = remainder.length > 0 ? `${first}/${remainder}` : `${first}/`;
    return `file:///${drivePath}`;
  }

  const unixSegments = first === '/' ? rest : segments;
  const pathBody = unixSegments.join('/');
  const absolutePath = pathBody.length > 0 ? `/${pathBody}` : '/';

  return `file://${absolutePath}`;
};

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.app.registerCommand({
    id: 'convert-to-file-link',
    name: 'Convert to File Link',
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
      
      if (!textString || textString.trim().length === 0) {
        await plugin.app.toast('The focused rem has no text content');
        return;
      }
      
      const pathTag = await ensurePathTag(plugin);
      if (!pathTag) {
        await plugin.app.toast('Unable to create or fetch the path tag');
        return;
      }
      
      await focusedRem.addTag(pathTag);

      const segments = await collectTaggedSegments(focusedRem, pathTag._id, plugin);
      
      // Trim leading/trailing whitespace but preserve interior spacing
      const trimmedText = textString.trim();
      const fileUrl =
        buildFileUrlFromSegments(segments) ?? 'file://' + trimmedText;
      
      // Create the link using the exact structure RemNote uses
      const linkElement = {
        i: 'm',
        text: trimmedText,
        iUrl: fileUrl
      };
      
      await focusedRem.setText([linkElement]);
      
      await plugin.app.toast('Converted to file:// link successfully');
    },
  });
}

async function onDeactivate(_plugin: ReactRNPlugin) {
  // Clean up if needed
}

declareIndexPlugin(onActivate, onDeactivate);
