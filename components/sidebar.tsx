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
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  LogOut,
  Menu,
  X,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import { useState } from 'react';

const navSections = [
  {
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'Estoque',
    items: [
      {
        title: 'Movimentações',
        href: '/movements',
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    label: 'Cadastro',
    items: [
      {
        title: 'Setores',
        href: '/sectors',
        icon: FolderOpen,
      },
      {
        title: 'Produtos',
        href: '/products',
        icon: Package,
      },
    ],
  },
  {
    label: 'Controle',
    items: [
      {
        title: 'Follow-up',
        href: '/follow-up',
        icon: ClipboardList,
      },
      {
        title: 'Fila de Reposição',
        href: '/replenishment-queue',
        icon: AlertTriangle,
      },
      {
        title: 'Variação de Preço',
        href: '/price-variation',
        icon: TrendingUp,
      },
    ],
  },
  {
    label: 'Relatórios',
    items: [
      {
        title: 'Pedidos',
        href: '/purchase-orders',
        icon: ShoppingCart,
      },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        title={mobileOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
        aria-label={mobileOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
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
          'fixed left-0 top-0 z-40 h-screen bg-brand-primary text-white transition-all duration-300 border-r border-emerald-800/30 flex flex-col',
          collapsed ? 'w-0 -translate-x-full lg:-translate-x-full overflow-hidden' : 'w-64',
          !collapsed && (mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
        )}
      >
        {/* Logo Section */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm">
            <Image src="/logo.png" alt="Silcon Logo" width={36} height={36} className="object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none tracking-tight font-inter text-white">Silcon Ambiental</h1>
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-100/70 mt-1 font-inter">Almoxarifado</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar">
          <div className="space-y-3">
            {navSections.map((section, sectionIndex) => (
              <div key={section.label ?? `section-${sectionIndex}`} className="space-y-1">
                {section.label && (
                  <p className="text-[8px] uppercase font-bold tracking-widest text-emerald-100/50 px-4 pb-1 font-inter">
                    {section.label}
                  </p>
                )}

                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'group flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200 font-inter',
                        isActive
                          ? 'bg-white text-brand-primary shadow-md'
                          : 'text-emerald-100/80 hover:text-white hover:bg-white/10'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'h-3.5 w-3.5 transition-colors',
                          isActive ? 'text-brand-primary' : 'text-emerald-100/70 group-hover:text-white'
                        )}
                      />
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* Bottom Section: Settings, Logout and Collapse */}
        <div className="p-3 border-t border-white/10 flex items-center">
          <div className="flex flex-row gap-2">
            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              className={cn(
                'group flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200',
                pathname === '/settings'
                  ? 'bg-white text-brand-primary shadow-md'
                  : 'text-emerald-100 hover:text-white hover:bg-white/10'
              )}
              title="Configurações"
              aria-label="Configurações"
            >
              <Settings
                className={cn(
                  'h-3.5 w-3.5 transition-colors',
                  pathname === '/settings' ? 'text-brand-primary' : 'text-emerald-100 group-hover:text-white'
                )}
              />
            </Link>

            <Button
              variant="ghost"
              className="h-9 w-9 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-300 transition-all p-0"
              onClick={logout}
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button
            variant="ghost"
            className="ml-auto h-9 w-9 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-all p-0"
            onClick={onToggleCollapse}
            title="Recolher sidebar"
            aria-label="Recolher sidebar"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </Button>
        </div>
      </aside>

      {collapsed && (
        <Button
          variant="ghost"
          size="icon"
          title="Expandir sidebar"
          aria-label="Expandir sidebar"
          className="hidden lg:flex fixed top-4 left-4 z-50 bg-slate-900 text-white rounded-lg shadow-lg"
          onClick={onToggleCollapse}
        >
          <PanelLeftOpen className="h-5 w-5" />
        </Button>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
      `}</style>
    </>
  );
}
