'use client';
import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { announcementsApi } from '@/lib/api';
import { Plus, Megaphone, Pin, Trash2, Heart, MessageCircle, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import RichTextEditor from '@/components/shared/RichTextEditor';

const EMOJIS = ['👍', '❤️', '🎉', '🚀', '👀', '🔥'];

export default function AnnouncementsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const { user } = useAuthStore();
  const { socket } = useSocketStore();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [newComment, setNewComment] = useState({});

  const fetchAnnouncements = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      const { data } = await announcementsApi.list(currentWorkspace.id);
      setAnnouncements(data.announcements);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { fetchAnnouncements(); }, [currentWorkspace?.id]);

  useEffect(() => {
    if (!socket) return;
    const handlers = {
      'announcement:created': (a) => setAnnouncements(prev => {
        if (prev.some(x => x.id === a.id)) return prev;
        return [a, ...prev];
      }),
      'announcement:updated': (a) => setAnnouncements(prev => prev.map(x => x.id === a.id ? { ...x, ...a } : x)),
      'announcement:deleted': ({ id }) => setAnnouncements(prev => prev.filter(x => x.id !== id)),
      'announcement:pinned': ({ id, isPinned }) => setAnnouncements(prev => prev.map(x => x.id === id ? { ...x, isPinned } : x)),
      'announcement:reacted': ({ announcementId, reactions }) => setAnnouncements(prev => prev.map(x => x.id === announcementId ? { ...x, reactions } : x)),
      'comment:created': ({ announcementId, comment }) => setAnnouncements(prev => prev.map(x => x.id === announcementId ? { ...x, comments: [...(x.comments || []), comment] } : x)),
    };
    Object.entries(handlers).forEach(([evt, fn]) => socket.on(evt, fn));
    return () => Object.entries(handlers).forEach(([evt, fn]) => socket.off(evt, fn));
  }, [socket]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId, title: newTitle, content: newContent, isPinned: false,
      author: user, reactions: [], _count: { comments: 0 }, comments: [],
      createdAt: new Date().toISOString(),
    };
    setAnnouncements(prev => [optimistic, ...prev]);
    setShowForm(false);
    setNewTitle(''); setNewContent('');
    try {
      const { data } = await announcementsApi.create({ title: newTitle, content: newContent, workspaceId: currentWorkspace.id });
      setAnnouncements(prev => prev.map(a => a.id === tempId ? data.announcement : a));
      toast.success('Announcement posted!');
    } catch (err) {
      setAnnouncements(prev => prev.filter(a => a.id !== tempId));
      toast.error(err.response?.data?.error || 'Failed to post announcement');
    }
  };

  const handleReact = async (id, emoji) => {
    // Optimistic update
    setAnnouncements(prev => prev.map(a => {
      if (a.id !== id) return a;
      const existing = a.reactions?.find(r => r.userId === user.id && r.emoji === emoji);
      if (existing) {
        return { ...a, reactions: a.reactions.filter(r => !(r.userId === user.id && r.emoji === emoji)) };
      } else {
        return { ...a, reactions: [...(a.reactions || []), { userId: user.id, emoji, user }] };
      }
    }));
    try {
      await announcementsApi.react(id, emoji);
    } catch (_) { fetchAnnouncements(); }
  };

  const handlePin = async (id) => {
    try {
      await announcementsApi.pin(id);
      toast.success('Pinned status updated');
    } catch (_) { toast.error('Failed to update pin'); }
  };

  const handleDelete = async (id) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    try {
      await announcementsApi.delete(id);
      toast.success('Announcement deleted');
    } catch (_) { fetchAnnouncements(); toast.error('Failed to delete'); }
  };

  const handleComment = async (announcementId, e) => {
    e.preventDefault();
    const content = newComment[announcementId];
    if (!content?.trim()) return;
    setNewComment(prev => ({ ...prev, [announcementId]: '' }));
    try {
      await announcementsApi.addComment(announcementId, { content });
    } catch (_) { toast.error('Failed to post comment'); }
  };

  const reactionGroups = (reactions) => {
    const groups = {};
    (reactions || []).forEach(r => {
      if (!groups[r.emoji]) groups[r.emoji] = [];
      groups[r.emoji].push(r);
    });
    return groups;
  };

  if (!currentWorkspace) return (
    <div className="flex items-center justify-center h-full text-[var(--text-muted)]"><p>Select a workspace</p></div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-brand-500" /> Announcements
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">Workspace-wide updates from admins</p>
        </div>
        {(currentWorkspace.role === 'ADMIN') && (
          <button id="create-announcement-btn" onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus className="w-4 h-4" /> Post
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card animate-slide-up border-2 border-brand-200 dark:border-brand-800">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label">Title *</label>
              <input id="ann-title" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="input" placeholder="Announcement title" required />
            </div>
            <div>
              <label className="label">Content *</label>
              <RichTextEditor content={newContent} onChange={setNewContent} placeholder="Write your announcement..." />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button id="ann-submit" type="submit" className="btn-primary"><Megaphone className="w-4 h-4" /> Post Announcement</button>
            </div>
          </form>
        </div>
      )}

      {/* Announcements list */}
      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-48 rounded-xl" />)}</div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
          <Megaphone className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium text-[var(--text-secondary)]">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(ann => {
            const isExpanded = expandedId === ann.id;
            const groups = reactionGroups(ann.reactions);
            return (
              <div key={ann.id} id={`announcement-${ann.id}`}
                className={clsx('card animate-fade-in', ann.isPinned && 'border-l-4 border-l-brand-500')}>
                {ann.isPinned && (
                  <div className="flex items-center gap-1 text-xs text-brand-500 font-medium mb-2">
                    <Pin className="w-3 h-3" /> Pinned
                  </div>
                )}
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {ann.author?.name?.[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[var(--text-primary)]">{ann.author?.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{format(new Date(ann.createdAt), 'MMM d, yyyy · h:mm a')}</p>
                    </div>
                  </div>
                  {currentWorkspace.role === 'ADMIN' && !ann.id.startsWith('temp-') && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handlePin(ann.id)} className={clsx('btn-icon p-1.5', ann.isPinned && 'text-brand-500')} title={ann.isPinned ? 'Unpin' : 'Pin'}>
                        <Pin className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(ann.id)} className="btn-icon p-1.5 text-red-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{ann.title}</h3>
                <div className="text-sm text-[var(--text-secondary)] leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: ann.content }} />

                {/* Reactions */}
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  {Object.entries(groups).map(([emoji, users]) => (
                    <button key={emoji}
                      onClick={() => handleReact(ann.id, emoji)}
                      className={clsx(
                        'flex items-center gap-1 px-2 py-1 rounded-full text-sm border transition-all duration-150',
                        users.find(u => u.userId === user?.id)
                          ? 'bg-brand-100 border-brand-300 dark:bg-brand-900/30 dark:border-brand-700'
                          : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:border-brand-300'
                      )}>
                      <span>{emoji}</span>
                      <span className="text-xs font-medium text-[var(--text-secondary)]">{users.length}</span>
                    </button>
                  ))}
                  {EMOJIS.filter(e => !groups[e]).map(emoji => (
                    <button key={emoji} onClick={() => handleReact(ann.id, emoji)}
                      className="px-2 py-1 rounded-full text-sm border border-dashed border-[var(--border)] hover:border-brand-300 bg-transparent opacity-40 hover:opacity-100 transition-all">
                      {emoji}
                    </button>
                  ))}

                  <button onClick={() => setExpandedId(isExpanded ? null : ann.id)}
                    className="ml-auto flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-brand-500 transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    {ann._count?.comments || ann.comments?.length || 0} comments
                  </button>
                </div>

                {/* Comments */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-3 animate-slide-up">
                    {(ann.comments || []).map(c => (
                      <div key={c.id} className="flex gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {c.author?.name?.[0]}
                        </div>
                        <div className="flex-1 bg-[var(--bg-secondary)] rounded-lg px-3 py-2">
                          <span className="text-xs font-semibold text-[var(--text-primary)] mr-2">{c.author?.name}</span>
                          <span className="text-xs text-[var(--text-muted)]">{format(new Date(c.createdAt), 'MMM d')}</span>
                          <p className="text-sm text-[var(--text-secondary)] mt-1">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    <form onSubmit={(e) => handleComment(ann.id, e)} className="flex gap-2">
                      <input
                        value={newComment[ann.id] || ''}
                        onChange={e => setNewComment(prev => ({ ...prev, [ann.id]: e.target.value }))}
                        placeholder="Write a comment..."
                        className="input flex-1 text-sm py-2"
                      />
                      <button type="submit" className="btn-primary px-3 py-2 text-sm">Post</button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
