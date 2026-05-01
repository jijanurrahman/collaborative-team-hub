'use client';
import { useState, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { usersApi, workspacesApi } from '@/lib/api';
import { Settings as SettingsIcon, User, Users, Shield, Link as LinkIcon, Camera, Copy, Check } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const { currentWorkspace, updateWorkspace, updateMemberRole } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [profileForm, setProfileForm] = useState({ name: user?.name || '' });
  const [wsForm, setWsForm] = useState({ name: currentWorkspace?.name || '', description: currentWorkspace?.description || '', accentColor: currentWorkspace?.accentColor || '#6366f1' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await usersApi.updateMe(profileForm);
      updateUser(data.user);
      toast.success('Profile updated');
    } catch (_) { toast.error('Failed to update profile'); }
    setSaving(false);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      toast.loading('Uploading avatar...', { id: 'avatar' });
      const { data } = await usersApi.uploadAvatar(formData);
      updateUser(data.user);
      toast.success('Avatar updated', { id: 'avatar' });
    } catch (_) { toast.error('Failed to upload avatar', { id: 'avatar' }); }
  };

  const handleWsUpdate = async (e) => {
    e.preventDefault();
    if (!currentWorkspace || currentWorkspace.role !== 'ADMIN') return;
    setSaving(true);
    try {
      const { data } = await workspacesApi.update(currentWorkspace.id, wsForm);
      updateWorkspace(data.workspace);
      toast.success('Workspace settings updated');
    } catch (_) { toast.error('Failed to update workspace'); }
    setSaving(false);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!currentWorkspace || currentWorkspace.role !== 'ADMIN') return;
    try {
      const { data } = await workspacesApi.invite(currentWorkspace.id, { email: inviteEmail, role: inviteRole });
      toast.success('Invitation sent!');
      setInviteEmail('');
      // Show link if they want to copy it
      const link = `${process.env.NEXT_PUBLIC_CLIENT_URL || window.location.origin}/invite/${data.invitation.token}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to send invite'); }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await workspacesApi.updateMemberRole(currentWorkspace.id, userId, role);
      updateMemberRole(currentWorkspace.id, userId, role);
      toast.success('Role updated');
    } catch (_) { toast.error('Failed to update role'); }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      await workspacesApi.removeMember(currentWorkspace.id, userId);
      // In a real app we'd update the store, but here we rely on the socket event to refresh
      toast.success('Member removed');
    } catch (_) { toast.error('Failed to remove member'); }
  };

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'workspace', label: 'Workspace Settings', icon: SettingsIcon, adminOnly: true },
    { id: 'members', label: 'Members & Roles', icon: Users, adminOnly: true },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
        <SettingsIcon className="w-6 h-6 text-brand-500" /> Settings
      </h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0 space-y-1">
          {tabs.map((tab) => {
            if (tab.adminOnly && currentWorkspace?.role !== 'ADMIN') return null;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={clsx('w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                )}>
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="card space-y-8 animate-fade-in">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Profile Picture</h2>
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    {user?.avatarUrl ? (
                      <Image src={user.avatarUrl} alt={user.name} width={80} height={80} className="rounded-full w-20 h-20 object-cover" />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                        {user?.name?.[0]}
                      </div>
                    )}
                    <button onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/50 text-white rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-5 h-5 mb-1" />
                      <span className="text-[10px]">Change</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--text-secondary)] mb-2">Upload a new avatar. Larger images will be resized automatically.</p>
                    <button onClick={() => fileInputRef.current?.click()} className="btn-secondary btn-sm">Upload Image</button>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Personal Information</h2>
                <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-md">
                  <div>
                    <label className="label">Full Name</label>
                    <input className="input" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="label">Email Address</label>
                    <input className="input opacity-70" value={user?.email || ''} disabled />
                    <p className="text-xs text-[var(--text-muted)] mt-1">Email cannot be changed.</p>
                  </div>
                  <button type="submit" disabled={saving} className="btn-primary mt-2">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'workspace' && currentWorkspace && (
            <div className="card space-y-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Workspace Settings</h2>
              <form onSubmit={handleWsUpdate} className="space-y-4 max-w-md">
                <div>
                  <label className="label">Workspace Name</label>
                  <input className="input" value={wsForm.name} onChange={e => setWsForm({ ...wsForm, name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input resize-none h-20" value={wsForm.description} onChange={e => setWsForm({ ...wsForm, description: e.target.value })} />
                </div>
                <div>
                  <label className="label">Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={wsForm.accentColor} onChange={e => setWsForm({ ...wsForm, accentColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                    <span className="text-sm font-mono text-[var(--text-muted)]">{wsForm.accentColor}</span>
                  </div>
                </div>
                <button type="submit" disabled={saving} className="btn-primary mt-2">
                  {saving ? 'Saving...' : 'Save Workspace'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'members' && currentWorkspace && (
            <div className="space-y-6 animate-fade-in">
              <div className="card">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Invite Member</h2>
                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address" className="input flex-1" required />
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="input sm:w-40">
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button type="submit" className="btn-primary whitespace-nowrap">Send Invite</button>
                </form>
                {copied && <p className="text-sm text-green-500 mt-2 flex items-center gap-1"><Check className="w-4 h-4"/> Invite link copied to clipboard</p>}
              </div>

              <div className="card overflow-hidden">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Manage Members</h2>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                        <th className="px-4 py-3 font-medium">User</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {(currentWorkspace.members || []).map((m) => (
                        <tr key={m.user.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {m.user.avatarUrl ? (
                                <Image src={m.user.avatarUrl} alt="" width={32} height={32} className="w-8 h-8 rounded-full" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                  {m.user.name[0]}
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-[var(--text-primary)]">{m.user.name}</p>
                                <p className="text-xs text-[var(--text-muted)]">{m.user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={m.role}
                              onChange={e => handleRoleChange(m.user.id, e.target.value)}
                              disabled={m.user.id === user.id} // Cannot change own role
                              className="input text-sm py-1 px-2 w-32 bg-transparent"
                            >
                              <option value="ADMIN">Admin</option>
                              <option value="MEMBER">Member</option>
                              <option value="VIEWER">Viewer</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleRemoveMember(m.user.id)}
                              disabled={m.user.id === user.id}
                              className="text-red-500 hover:text-red-600 text-sm font-medium disabled:opacity-30"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
