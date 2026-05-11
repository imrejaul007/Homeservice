import React from 'react';
import { PageLayout } from '../../components/layout';
import { AvailabilityManager } from '../../components/booking';

const ProviderAvailabilityPage: React.FC = () => {
  return (
    <PageLayout title="Availability Management">
      <AvailabilityManager />
    </PageLayout>
  );
};

export default ProviderAvailabilityPage;