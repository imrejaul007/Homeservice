import React from 'react';
import PageLayout from '../components/layout/PageLayout';
import ServiceManagement from '../components/provider/ServiceManagement';

const ServiceManagementPage: React.FC = () => {
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/provider/dashboard' },
    { label: 'Service Management', current: true }
  ];

  return (
    <PageLayout 
      title="Service Management"
      showBreadcrumb={true}
      breadcrumbItems={breadcrumbItems}
    >
      <ServiceManagement />
    </PageLayout>
  );
};

export default ServiceManagementPage;