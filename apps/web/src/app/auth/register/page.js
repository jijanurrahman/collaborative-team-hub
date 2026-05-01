'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    const result = await register({ name: form.name, email: form.email, password: form.password });
    if (result.success) {
      toast.success('Account created! Welcome to Team Hub 🎉');
      router.push('/dashboard');
    } else {
      toast.error(result.error || 'Registration failed');
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all";
  const labelClass = "block text-sm font-medium text-slate-300 mb-1.5";

  return (
    <div className="animate-slide-up">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 mb-4 shadow-xl">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white">Create account</h1>
        <p className="text-slate-400 mt-1">Join Team Hub today</p>
      </div>

      <div className="glass rounded-2xl p-8 border border-white/10">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Full Name</label>
            <input id="reg-name" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" className={inputClass} required minLength={2} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input id="reg-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <input id="reg-password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 8 chars, 1 uppercase, 1 number" className={inputClass} required minLength={8} />
          </div>
          <div>
            <label className={labelClass}>Confirm Password</label>
            <input id="reg-confirm" type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} placeholder="••••••••" className={inputClass} required />
          </div>

          <button id="reg-submit" type="submit" disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-brand-500 to-purple-600 text-white font-semibold rounded-xl hover:from-brand-600 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-brand-500/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2">
            {isLoading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account...</>
            ) : 'Create Account'}
          </button>
        </form>
      </div>

      <p className="text-center text-slate-400 text-sm mt-6">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">Sign in</Link>
      </p>
    </div>
  );
}
