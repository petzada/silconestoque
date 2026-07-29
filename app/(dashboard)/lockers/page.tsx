'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LockersPanel } from '@/components/lockers/lockers-panel';

function LockersPageContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(
    searchParams.get('tab') === 'vestiario' ? 'vestiario' : 'uniforme'
  );

  return (
    <PageContainer>
      <PageHeader
        title="Armários"
        description="Armários de uniforme e de vestiário por colaborador"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="uniforme" className="text-xs">
            Uniformes
          </TabsTrigger>
          <TabsTrigger value="vestiario" className="text-xs">
            Vestiário
          </TabsTrigger>
        </TabsList>

        <TabsContent value="uniforme">
          <LockersPanel kind="uniforme" />
        </TabsContent>
        <TabsContent value="vestiario">
          <LockersPanel kind="vestiario" />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

export default function LockersPage() {
  return (
    <Suspense fallback={<PageLoading label="Carregando armários..." />}>
      <LockersPageContent />
    </Suspense>
  );
}
