'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { Bold, Italic, List, ListOrdered, Quote, Link2, Code } from 'lucide-react';
import clsx from 'clsx';
import { useEffect } from 'react';

const ToolbarBtn = ({ onClick, active, title, children }) => (
  <button type="button" onMouseDown={e => { e.preventDefault(); onClick(); }}
    className={clsx('p-1.5 rounded transition-colors', active ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]')}
    title={title}>
    {children}
  </button>
);

export default function RichTextEditor({ content, onChange, placeholder = 'Write something...' }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'focus:outline-none min-h-[120px] text-sm text-[var(--text-primary)]' },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '', false);
    }
  }, [content]);

  if (!editor) return null;

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-primary)]">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--border)] flex-wrap">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Code">
          <Code className="w-4 h-4" />
        </ToolbarBtn>
        <div className="w-px h-4 bg-[var(--border)] mx-1" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered list">
          <ListOrdered className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <Quote className="w-4 h-4" />
        </ToolbarBtn>
      </div>
      {/* Content */}
      <div className="p-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
