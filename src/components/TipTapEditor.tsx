import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';
import { useCallback, useEffect } from 'react';

interface Props {
  content: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}

export const TipTapEditor = ({ content, onChange, placeholder }: Props) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-xl shadow-sm border border-gray-100 max-w-full h-auto my-4 cursor-zoom-in transition-transform hover:scale-[1.01]'
        }
      }),
      Placeholder.configure({
        placeholder: placeholder || '开始记录...',
      }),
      Markdown.configure({
        html: true,
        tightLists: true,
        tightListClass: 'tight',
        bulletListMarker: '-',
        linkify: true,
        breaks: true,
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      try {
        // @ts-ignore - markdown extension adds this method
        const markdownStorage = editor.storage.markdown;
        if (markdownStorage && typeof markdownStorage.getMarkdown === 'function') {
          const markdown = markdownStorage.getMarkdown();
          // Only trigger onChange if the content is actually different from the last set content
          // to avoid infinite loops or unnecessary parent re-renders
          if (markdown !== content) {
            onChange(markdown);
          }
        }
      } catch (e) {
        console.error("TipTap update error:", e);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm md:prose-base prose-stone max-w-none focus:outline-none min-h-[150px] cursor-text \
                prose-h1:text-2xl prose-h1:font-black prose-h1:pb-2 prose-h1:border-b \
                prose-h2:text-xl prose-h2:font-extrabold prose-h2:border-l-4 prose-h2:border-memos-accent prose-h2:pl-4 \
                prose-h3:text-lg prose-h3:font-bold \
                prose-code:text-memos-accent prose-code:bg-gray-100 prose-code:rounded prose-code:px-1 \
                prose-pre:bg-slate-900 prose-pre:rounded-xl'
      },
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find(item => item.type.startsWith('image'));

        if (imageItem) {
          event.preventDefault();
          event.stopPropagation();
          const file = imageItem.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64 = e.target?.result as string;
              if (base64) {
                const { schema } = view.state;
                const node = schema.nodes.image.create({ src: base64 });
                const transaction = view.state.tr.replaceSelectionWith(node);
                view.dispatch(transaction);
              }
            };
            reader.readAsDataURL(file);
          }
          return true;
        }
        return false;
      }
    }
  });

  // Keep editor content in sync with external changes (e.g. switching daily entries)
  useEffect(() => {
    if (editor && content !== undefined) {
      try {
        // @ts-ignore
        const markdownStorage = editor.storage.markdown;
        if (markdownStorage && typeof markdownStorage.getMarkdown === 'function') {
          const currentMarkdown = markdownStorage.getMarkdown();
          // Use a basic normalization (trimming) for comparison to avoid small whitespace differences
          // from triggering unnecessary document re-sets.
          if (content.trim() !== currentMarkdown.trim()) {
            editor.commands.setContent(content, { emitUpdate: false });
          }
        }
      } catch (e) {
        console.error("TipTap content sync error:", e);
      }
    }
  }, [content, editor]);

  return (
    <div className="w-full h-full">
      <EditorContent editor={editor} />
    </div>
  );
};
