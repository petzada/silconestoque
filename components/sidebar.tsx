'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  Tags,
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
import { useAuth } from '@/components/auth-provider';
import { useState } from 'react';

const navSections = [
  {
    items: [{ title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Estoque',
    items: [
      { title: 'Movimentações', href: '/movements', icon: ArrowLeftRight },
      { title: 'Produtos', href: '/products', icon: Package },
      { title: 'Categorias', href: '/categories', icon: Tags },
    ],
  },
  {
    label: 'Compras',
    items: [
      { title: 'Fila de Reposição', href: '/replenishment-queue', icon: AlertTriangle },
      { title: 'Sugestões de Compra', href: '/purchase-orders', icon: ShoppingCart },
      { title: 'Follow-up', href: '/follow-up', icon: ClipboardList },
      { title: 'Variação de Preço', href: '/price-variation', icon: TrendingUp },
    ],
  },
  {
    label: 'Pessoal',
    items: [
      { title: 'Colaboradores', href: '/employees', icon: Users },
      { title: 'Setores', href: '/sectors', icon: FolderOpen },
      { title: 'Armários', href: '/lockers', icon: Lock },
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
        variant="outline"
        size="icon"
        title={mobileOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
        aria-label={mobileOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
        className="fixed top-4 left-4 z-50 lg:hidden bg-card"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay: solid, no atmospheric blur effect (DESIGN.md forbids
          it) and no pure black (rgba(22,22,22,.5) over --foreground). */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ backgroundColor: 'rgba(22, 22, 22, 0.5)' }}
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
          <div className="flex items-center justify-center w-10 h-10 overflow-hidden bg-muted shrink-0">
            <Image src="/logo.png" alt="Silcon Logo" width={32} height={32} className="object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-display text-sm leading-tight text-foreground truncate">
              Silcon Ambiental
            </h1>
            <p className="text-caption text-xs text-muted-foreground truncate">
              Almoxarifado
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar">
          <div className="space-y-5">
            {navSections.map((section, sectionIndex) => (
              <div key={section.label ?? `section-${sectionIndex}`} className="space-y-1">
                {/* Rotulo de secao sem alpha: --muted-foreground a 70% sobre
                    canvas branco resolve para ~#8a8a8a e reprova AA (~3,4:1). */}
                {section.label && (
                  <p className="text-caption text-xs text-muted-foreground px-3 pb-1">
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
                        // V3: active item is a 2px left rule + weight 600,
                        // never a blue fill. The gray fill (sidebar-accent)
                        // is Carbon's own selected-nav-item convention
                        // (layer-selected), paired with the rule, not a
                        // substitute for it. border-l-2 border-transparent
                        // on every item reserves the width so the active
                        // state never shifts content by 2px.
                        'group relative flex h-8 items-center gap-3 border-l-2 border-transparent px-3 text-sm font-medium transition-colors',
                        isActive
                          ? 'border-sidebar-primary bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
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
              'inline-flex size-8 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              pathname === '/settings'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <Settings className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={logout}
            title="Sair"
            aria-label="Sair"
            className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:bg-danger-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          >
            <LogOut className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            title="Recolher menu"
            aria-label="Recolher menu"
            className="ml-auto inline-flex size-8 items-center justify-center text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
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
          className="hidden lg:flex fixed top-4 left-4 z-50 bg-card"
          onClick={onToggleCollapse}
        >
          <PanelLeftOpen className="h-5 w-5" />
        </Button>
      )}
    </>
  );
}
