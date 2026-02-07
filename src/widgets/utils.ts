export const WINDOWS_DRIVE_SEGMENT_REGEX = /^[a-zA-Z]:$/;

export async function hasPathTag(rem: any, pathTagId: string) {
  const tagRems = await rem.getTagRems();
  return tagRems?.some((tag: any) => tag._id === pathTagId) ?? false;
}

function extractTextFromRichText(richText: any): string {
  if (!Array.isArray(richText)) return '';
  return richText.map((el: any) => {
    if (typeof el === 'string') return el;
    return el?.text ?? '';
  }).join('');
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
