'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  ArrowLeftRight,
  ShoppingCart,
  LogOut,
  Menu,
  X,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import { useState } from 'react';

const navItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Produtos',
    href: '/products',
    icon: Package,
  },
  {
    title: 'Movimentações',
    href: '/movements',
    icon: ArrowLeftRight,
  },
  {
    title: 'Setores',
    href: '/sectors',
    icon: FolderOpen,
  },
  {
    title: 'Pedidos de Compra',
    href: '/purchase-orders',
    icon: ShoppingCart,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-slate-900 text-white rounded-lg shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 bg-[#387146] text-white transition-all duration-300 lg:translate-x-0 border-r border-emerald-800/30 flex flex-col',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo Section */}
        <div className="flex items-center gap-3 px-6 py-8 border-b border-white/10">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm">
            <Image src="/logo.png" alt="Silcon Logo" width={36} height={36} className="object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none tracking-tight font-inter text-white">Silcon Ambiental</h1>
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-100/70 mt-1 font-inter">Almoxarifado</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {/* Label Controle */}
          <p className="text-[9px] uppercase font-bold tracking-widest text-emerald-100/50 px-4 pb-2 font-inter">Controle</p>

          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'group flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-200 font-inter',
                  isActive
                    ? 'bg-white text-[#387146] shadow-md'
                    : 'text-emerald-100/80 hover:text-white hover:bg-white/10'
                )}
              >
                <item.icon className={cn(
                  "h-4 w-4 transition-colors",
                  isActive ? "text-[#387146]" : "text-emerald-100/70 group-hover:text-white"
                )} />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section: Settings & Logout */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <Link
            href="/settings"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'group flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 font-inter',
              pathname === '/settings'
                ? 'bg-white text-[#387146] shadow-md'
                : 'text-emerald-100 hover:text-white hover:bg-white/10'
            )}
          >
            <Settings className={cn(
              "h-4 w-4 transition-colors",
              pathname === '/settings' ? "text-[#387146]" : "text-emerald-100 group-hover:text-white"
            )} />
            <span>AJUSTES</span>
          </Link>

          <Button
            variant="ghost"
            className="w-full justify-start h-10 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-all text-xs font-bold font-inter px-4"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-3" />
            FINALIZAR SESSÃO
          </Button>
        </div>
      </aside>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
      `}</style>
    </>
  );
}
