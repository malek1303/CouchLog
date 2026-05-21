'use client';

import { Mail, Linkedin, Github, Cpu, Tv, Heart } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="animate-fade-in max-w-4xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="mb-10 text-center md:text-left">
        <h1 className="mb-2">About CouchLog</h1>
        <p className="text-muted text-lg max-w-2xl">
          A sleek, centralized platform built to manage your movie and TV show watchlists and track your exact viewing pause-points.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Project Section */}
        <div className="md:col-span-2 space-y-6">
          <div className="card p-6 relative overflow-hidden group">
            {/* Ambient background glow */}
            <div className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-brand/10 blur-3xl transition-all group-hover:bg-brand/15" />
            
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Tv size={20} className="text-brand animate-pulse" />
              Why CouchLog?
            </h2>
            <p className="text-sm text-subtle leading-relaxed mb-4">
              CouchLog was born out of a simple need: a desire for a unified, modern, and beautiful interface to organize watchlists and track progress without dealing with bloated trackers.
            </p>
            <p className="text-sm text-subtle leading-relaxed">
              Whether it's checking off seasons, managing TV show episodes, or setting precise timestamp pause-points down to the second, CouchLog is designed to make sure you never lose your spot on the couch again.
            </p>
          </div>

          <div className="card p-6 relative overflow-hidden group">
            {/* Ambient background glow */}
            <div className="absolute -left-16 -bottom-16 w-36 h-36 rounded-full bg-accent/10 blur-3xl transition-all group-hover:bg-accent/15" />
            
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Cpu size={20} className="text-accent" />
              The Developer
            </h2>
            <div className="space-y-4">
              <p className="text-sm text-subtle leading-relaxed">
                Hi, I'm <strong className="text-text">Malek Mahdy</strong>. I am an Electronics and Communications Engineering student based in Egypt, deeply passionate about Embedded Systems, low-level driver development, and bare-metal programming.
              </p>
              
              {/* Retro Terminal Shell Mockup */}
              <div 
                className="text-xs text-subtle leading-relaxed font-mono p-4 rounded-xl border"
                style={{
                  background: 'hsl(var(--color-surface-2) / 0.7)',
                  borderColor: 'hsl(var(--color-border) / 0.5)',
                  boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.05)'
                }}
              >
                <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-white/5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  <span className="text-[10px] text-muted ml-2">malek@archlinux:~</span>
                </div>
                <div>
                  <span className="text-emerald-400 font-semibold">malek@archlinux</span>:<span className="text-blue-400">~</span>$ neofetch --os "Arch Linux"<br />
                  <span className="text-brand font-bold">OS:</span> Arch Linux (I use Arch, btw 🐧)<br />
                  <span className="text-accent font-bold">Main Focus:</span> Embedded Systems & AVR Microcontrollers<br />
                  <span className="text-success font-bold">Community:</span> Head of the Embedded Systems Committee at IEEE MUST SB<br />
                  <span className="text-subtle font-bold">Current Dev:</span> Soil Aeration & Irrigation Automation Systems
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          {/* Core Skills & Focus Areas */}
          <div className="card p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">Core Skills</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-brand" />
                <span className="text-xs font-medium text-subtle">Bare-metal C & AVR Drivers</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-xs font-medium text-subtle">PCB Design & MC Interface</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-xs font-medium text-subtle">CCNA Network Infrastructure</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-xs font-medium text-subtle">Embedded ML (1D CNNs)</span>
              </div>
            </div>
          </div>

          {/* Let's Connect */}
          <div className="card p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">Let's Connect</h2>
            <div className="space-y-3">
              <a
                href="mailto:malekmahdy@ieee.org"
                className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold hover:bg-white/[0.03] transition-all"
                style={{
                  border: '1px solid hsl(var(--color-border) / 0.6)',
                  color: 'hsl(var(--color-brand))',
                  background: 'hsl(var(--color-brand) / 0.02)'
                }}
              >
                <Mail size={15} />
                <span>malekmahdy@ieee.org</span>
              </a>

              <a
                href="https://linkedin.com/in/malek-mahdy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold hover:bg-white/[0.03] transition-all"
                style={{ border: '1px solid hsl(var(--color-border) / 0.6)', color: 'hsl(var(--color-text-muted))' }}
              >
                <Linkedin size={15} className="text-blue-400" />
                <span>LinkedIn Profile</span>
              </a>

              <a
                href="https://github.com/malek1303"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold hover:bg-white/[0.03] transition-all"
                style={{ border: '1px solid hsl(var(--color-border) / 0.6)', color: 'hsl(var(--color-text-muted))' }}
              >
                <Github size={15} />
                <span>GitHub Profile</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Acknowledgement */}
      <div className="mt-12 text-center text-xs text-subtle flex items-center justify-center gap-1.5">
        <span>Made with</span>
        <Heart size={12} className="text-red-500 fill-red-500 animate-pulse" />
        <span>in Egypt by Malek Mahdy</span>
      </div>
    </div>
  );
}
