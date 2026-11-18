import type { ReactNode } from 'react';
import { useState } from 'react';
import { BookOpen, FileText, GraduationCap, LayoutDashboard, LogOut, Bell, Menu, Search, ChevronRight, X, MessagesSquare, Users } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getData } from '../lib/api';
import { ThemeToggle } from '../theme/ThemeContext';
import { UserAvatar } from './UserAvatar';

export function Logo() { return <div className="flex items-center gap-2"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gold text-ink"><GraduationCap size={23}/></div><div><strong className="font-serif text-lg leading-none">Rhyme</strong><span className="block text-[10px] font-bold uppercase tracking-[.16em] text-forest">Training Institute</span></div></div>; }

const nav = {
  LEARNER: [['Dashboard', '/', LayoutDashboard], ['My courses', '/courses', BookOpen], ['Grades', '/grades', FileText], ['Chat', '/chat', MessagesSquare], ['Notifications', '/notifications', Bell]],
  LECTURER: [['Dashboard', '/', LayoutDashboard], ['My courses', '/courses', BookOpen], ['Chat', '/chat', MessagesSquare]],
  ADMIN: [['Dashboard', '/', LayoutDashboard], ['Academic structure', '/structure', GraduationCap], ['Courses', '/courses', BookOpen], ['Users', '/users', Users], ['Chat', '/chat', MessagesSquare]],
} as const;

export function Shell({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth();
  const go = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useQuery({ queryKey: ['notification-count'], queryFn: () => getData<Array<{ readAt: string | null }>>('/notifications'), refetchInterval: 30000 });
  if (!session) return null;
  const first = session.user.profile?.firstName || 'Member';
  const links = <><Link to="/" onClick={() => setOpen(false)} aria-label="Rhyme home"><Logo/></Link><p className="mt-10 label">Workspace</p><nav className="mt-3 space-y-1">{nav[session.user.role].map(([name, path, Icon]) => <NavLink key={path} to={path} end={path === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}><Icon size={18}/>{name}</NavLink>)}</nav><button onClick={async () => { await logout(); go('/login'); }} className="nav-item mt-auto"><LogOut size={18}/>Sign out</button></>;
  return <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]"><aside className="hidden border-r border-ink/10 bg-white px-5 py-6 lg:flex lg:flex-col">{links}</aside>{open&&<div className="fixed inset-0 z-50 bg-ink/45 lg:hidden" onClick={()=>setOpen(false)}><aside className="flex h-full w-[min(84vw,320px)] flex-col bg-white px-5 py-6" onClick={event=>event.stopPropagation()}><button className="mb-6 self-end" aria-label="Close navigation" onClick={()=>setOpen(false)}><X/></button>{links}</aside></div>}<main className="min-w-0"><header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-ink/10 bg-white px-4 sm:px-8"><div className="flex items-center gap-2"><button onClick={()=>setOpen(true)} className="rounded-lg p-2 hover:bg-mint lg:hidden" aria-label="Open navigation"><Menu/></button><Link to="/" className="lg:hidden"><Logo/></Link><div className="hidden items-center gap-2 rounded-xl bg-sand px-3 py-2 text-sm text-ink/50 md:flex"><Search size={16}/>Learning space</div></div><div className="flex items-center gap-2 sm:gap-4"><ThemeToggle/><Link to="/notifications" aria-label="Notifications" className="relative rounded-xl p-2 hover:bg-mint"><Bell size={20}/>{notifications.some(item=>!item.readAt)&&<i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-coral"/>}</Link><Link to="/profile" className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-mint"><UserAvatar src={session.user.profile?.avatarUrl} name={first} size="sm"/><span className="hidden text-sm font-bold sm:block">{first}</span></Link></div></header><div className="mx-auto max-w-7xl p-4 sm:p-8">{children}</div></main></div>;
}

export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) { return <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div>{eyebrow&&<p className="label mb-2">{eyebrow}</p>}<h1 className="font-serif text-3xl font-bold text-ink sm:text-4xl">{title}</h1></div>{children}</div>; }
export function Empty({ title, body }: { title: string; body: string }) { return <div className="card grid min-h-56 place-items-center p-8 text-center"><div><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-mint"><FileText className="text-forest"/></div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm text-ink/60">{body}</p></div></div>; }
export function Loading() { return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map(item=><div key={item} className="h-32 animate-pulse rounded-2xl bg-ink/10"/>)}</div>; }
export const Arrow = () => <ChevronRight size={17}/>;
