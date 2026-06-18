'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Target, Calendar, Settings, ChevronRight,
  Building2, Zap, Mail
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/campaigns', label: 'Campaigns', icon: Target },
  { href: '/outreach', label: 'Outreach', icon: Mail },
  { href: '/meetings', label: 'Meetings', icon: Calendar },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-[#1A1D2E] text-white flex flex-col shrink-0 h-screen">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1B4DFF] rounded-lg flex items-center justify-center">
            <Building2 size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Innago</div>
            <div className="text-xs text-white/50 leading-tight">PO Outreach</div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#1B4DFF] text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} />
              {label}
              {isActive && <ChevronRight size={14} className="ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Phase legend */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="text-xs text-white/30 font-medium uppercase tracking-wider mb-3">Pipeline Phases</div>
        <div className="space-y-2">
          {[
            { color: 'bg-[#2D3748]', label: 'Phase 1 — Build List' },
            { color: 'bg-[#1E4033]', label: 'Phase 2 — Reach Out' },
            { color: 'bg-[#3B1F5E]', label: 'Phase 3 — Convert' },
            { color: 'bg-[#4A1F07]', label: 'Phase 4 — Close' },
          ].map((p) => (
            <div key={p.label} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${p.color} ring-1 ring-white/20`} />
              <span className="text-xs text-white/40">{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Power badge */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-1.5 text-xs text-white/20">
          <Zap size={10} />
          <span>Powered by Apollo · Brevo · Claude</span>
        </div>
      </div>
    </aside>
  );
}
