import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';
import { ConfirmProvider } from '@/components/ui/confirm-provider';
import { Toaster } from '@/components/ui/sonner';

const ibmPlexSans = IBM_Plex_Sans({
  variable: '--font-ibm-plex-sans',
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '600'],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin', 'latin-ext'],
  weight: ['400'],
});

export const metadata: Metadata = {
  title: 'Silcon Ambiental - Gestão de Estoque',
  description: 'Sistema de gerenciamento de estoque para gestão de resíduos hospitalares',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} font-sans antialiased`}>
        <AuthProvider>
          <ConfirmProvider>
            {children}
            <Toaster position="bottom-right" richColors />
          </ConfirmProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
