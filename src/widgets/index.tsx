import { declareIndexPlugin, ReactRNPlugin } from '@remnote/plugin-sdk';

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
      
      // Strip all whitespace from the text
      const trimmedText = textString.replace(/\s+/g, '');
      const fileUrl = 'file://' + trimmedText;
      
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