import React from 'react';
import { PageLayout } from '../../components/layout';
import { BookingList } from '../../components/booking';

const ProviderBookingsPage: React.FC = () => {
  return (
    <PageLayout title="Service Requests">
      <BookingList userType="provider" />
    </PageLayout>
  );
};

export default ProviderBookingsPage;