import Link from 'next/link';

export const metadata = { title: 'Welcome to Team Hub' };

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Mesh background */}
      <div className="absolute inset-0 bg-mesh opacity-40" />
      {/* Animated orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 text-center max-w-4xl mx-auto animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-brand-500/40">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white">Team Hub</h1>
        </div>

        <h2 className="text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight">
          Your team, <span className="text-gradient">in sync.</span>
        </h2>
        <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto leading-relaxed">
          Manage shared goals, post announcements, and track action items — all in real time.
          Built for modern teams that move fast.
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {[
            { icon: '🎯', title: 'Goals & Milestones', desc: 'Track progress with nested milestones and activity feeds' },
            { icon: '⚡', title: 'Real-time Updates', desc: 'Live socket updates so everyone stays in sync' },
            { icon: '🎨', title: 'Beautiful Kanban', desc: 'Drag-and-drop action items across your workflow' },
          ].map((f) => (
            <div key={f.title} className="glass rounded-2xl p-5 text-left hover:bg-white/15 transition-all duration-200">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-white font-semibold mb-1">{f.title}</h3>
              <p className="text-slate-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/register" className="btn-primary btn-lg text-base shadow-2xl shadow-brand-500/30 hover:shadow-brand-500/50 transition-all">
            Get Started Free
          </Link>
          <Link href="/auth/login" className="btn-secondary btn-lg bg-white/10 border-white/20 text-white hover:bg-white/20">
            Sign In
          </Link>
        </div>

        <p className="text-slate-500 text-sm mt-8">
          Demo: <span className="text-slate-400">jijanur@gmail.com</span> / <span className="text-slate-400">jijan1234</span>
        </p>
      </div>
    </main>
  );
}
