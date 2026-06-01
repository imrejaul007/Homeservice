import PageLayout from '../layout/PageLayout';
import { AdminNav } from './AdminNav';

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface AdminPageShellProps {
  title: string;
  subtitle?: string;
  breadcrumbItems?: BreadcrumbItem[];
  headerActions?: React.ReactNode;
  backHref?: string;
  pendingVerifications?: number;
  showSidebar?: boolean;
  /** Use wider main column for tables and dashboards */
  wideLayout?: boolean;
  children: React.ReactNode;
}

export function AdminPageShell({
  title,
  subtitle,
  breadcrumbItems,
  headerActions,
  backHref = '/admin/dashboard',
  pendingVerifications = 0,
  showSidebar = true,
  wideLayout = false,
  children,
}: AdminPageShellProps) {
  const crumbs = breadcrumbItems ?? [
    { label: 'Admin', href: '/admin/dashboard' },
    { label: title, current: true },
  ];

  return (
    <PageLayout
      title={title}
      subtitle={subtitle}
      breadcrumbItems={crumbs}
      backHref={backHref}
      headerActions={headerActions}
      contentWidth={wideLayout ? 'wide' : 'default'}
    >
      {showSidebar ? (
        <div className="flex flex-col xl:flex-row gap-4">
          <aside className="xl:w-[15.5rem] flex-shrink-0">
            <div className="xl:sticky xl:top-6">
              <AdminNav pendingVerifications={pendingVerifications} />
            </div>
          </aside>
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      ) : (
        children
      )}
    </PageLayout>
  );
}

export default AdminPageShell;
