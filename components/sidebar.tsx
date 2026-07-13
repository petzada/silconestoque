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
  Users,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/components/auth-provider';
import { useState } from 'react';

const navSections = [
  {
    items: [{ title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Estoque',
    items: [{ title: 'Movimentações', href: '/movements', icon: ArrowLeftRight }],
  },
  {
    label: 'Cadastro',
    items: [
      { title: 'Setores', href: '/sectors', icon: FolderOpen },
      { title: 'Produtos', href: '/products', icon: Package },
    ],
  },
  {
    label: 'Pessoal',
    items: [
      { title: 'Colaboradores', href: '/employees', icon: Users },
      { title: 'Armários & Chapas', href: '/lockers', icon: Lock },
    ],
  },
  {
    label: 'Controle',
    items: [
      { title: 'Follow-up', href: '/follow-up', icon: ClipboardList },
      { title: 'Fila de Reposição', href: '/replenishment-queue', icon: AlertTriangle },
      { title: 'Variação de Preço', href: '/price-variation', icon: TrendingUp },
    ],
  },
  {
    label: 'Relatórios',
    items: [{ title: 'Pedidos', href: '/purchase-orders', icon: ShoppingCart }],
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
        variant="outline"
        size="icon"
        title={mobileOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
        aria-label={mobileOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
        className="fixed top-4 left-4 z-50 lg:hidden bg-card shadow-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 border-r border-sidebar-border flex flex-col',
          collapsed ? 'w-0 -translate-x-full lg:-translate-x-full overflow-hidden' : 'w-64',
          !collapsed && (mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg overflow-hidden bg-muted shrink-0">
            <Image src="/logo.png" alt="Silcon Logo" width={36} height={36} className="object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm leading-tight tracking-tight text-foreground truncate">
              Silcon Ambiental
            </h1>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground truncate">
              Almoxarifado
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar">
          <div className="space-y-5">
            {navSections.map((section, sectionIndex) => (
              <div key={section.label ?? `section-${sectionIndex}`} className="space-y-1">
                {section.label && (
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/70 px-3 pb-1">
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
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                      )}
                      <item.icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isActive
                            ? 'text-sidebar-primary'
                            : 'text-muted-foreground group-hover:text-sidebar-accent-foreground'
                        )}
                      />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* Footer: Settings, theme, logout + collapse */}
        <div className="flex items-center gap-1 border-t border-sidebar-border p-3 shrink-0">
          <Link
            href="/settings"
            onClick={() => setMobileOpen(false)}
            title="Configurações"
            aria-label="Configurações"
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              pathname === '/settings'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <Settings className="h-4 w-4" />
          </Link>

          <ThemeToggle />

          <button
            type="button"
            onClick={logout}
            title="Sair"
            aria-label="Sair"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
          >
            <LogOut className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            title="Recolher menu"
            aria-label="Recolher menu"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {collapsed && (
        <Button
          variant="outline"
          size="icon"
          title="Expandir menu"
          aria-label="Expandir menu"
          className="hidden lg:flex fixed top-4 left-4 z-50 bg-card shadow-sm"
          onClick={onToggleCollapse}
        >
          <PanelLeftOpen className="h-5 w-5" />
        </Button>
      )}
    </>
  );
}
