import React, { useState } from 'react';
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Plus,
  Search,
  MoreVertical,
  Mail,
  Phone,
  Shield,
  AlertTriangle,
  Check,
  X,
  Download,
  Calendar,
  DollarSign,
  FileText,
  Settings,
  UserPlus
} from 'lucide-react';
import { cn } from '../../lib/utils';

type AccountStatus = 'pending' | 'active' | 'suspended' | 'cancelled';
type EmployeeRole = 'employee' | 'manager' | 'admin';

interface CorporateAccount {
  accountId: string;
  companyName: string;
  companyEmail: string;
  status: AccountStatus;
  spendingLimit?: { monthly?: number; perTransaction?: number };
  currentBalance: number;
  creditLimit: number;
  paymentTerms: string;
  employeeCount: number;
}

interface Employee {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: EmployeeRole;
  department?: string;
  spendingLimit?: number;
  isActive: boolean;
}

interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: Date;
  period: string;
}

interface CorporateDashboardProps {
  account: CorporateAccount;
  employees: Employee[];
  invoices: Invoice[];
  onAddEmployee: (employee: Omit<Employee, 'employeeId' | 'isActive'>) => Promise<void>;
  onUpdateEmployee: (employeeId: string, updates: Partial<Employee>) => Promise<void>;
  onRemoveEmployee: (employeeId: string) => Promise<void>;
  onApproveEmployee?: (employeeId: string) => Promise<void>;
  isAdmin?: boolean;
}

const CorporateDashboard: React.FC<CorporateDashboardProps> = ({
  account,
  employees,
  invoices,
  onAddEmployee,
  onUpdateEmployee,
  onRemoveEmployee,
  onApproveEmployee,
  isAdmin = false,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'employees' | 'billing' | 'settings'>('overview');
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'employee' as EmployeeRole,
    department: '',
    spendingLimit: undefined as number | undefined,
  });
  const [searchQuery, setSearchQuery] = useState('');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-AE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const statusColors: Record<AccountStatus, { bg: string; text: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    active: { bg: 'bg-green-100', text: 'text-green-700' },
    suspended: { bg: 'bg-red-100', text: 'text-red-700' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-700' },
  };

  const roleColors: Record<EmployeeRole, { bg: string; text: string }> = {
    employee: { bg: 'bg-gray-100', text: 'text-gray-700' },
    manager: { bg: 'bg-blue-100', text: 'text-blue-700' },
    admin: { bg: 'bg-purple-100', text: 'text-purple-700' },
  };

  const filteredEmployees = employees.filter(emp =>
    `${emp.firstName} ${emp.lastName} ${emp.email}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddEmployee = async () => {
    if (!newEmployee.firstName || !newEmployee.lastName || !newEmployee.email) return;

    try {
      await onAddEmployee(newEmployee);
      setShowAddEmployee(false);
      setNewEmployee({
        firstName: '',
        lastName: '',
        email: '',
        role: 'employee',
        department: '',
        spendingLimit: undefined,
      });
    } catch (error) {
      console.error('Failed to add employee:', error);
    }
  };

  const creditUtilization = account.creditLimit > 0
    ? (account.currentBalance / account.creditLimit) * 100
    : 0;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'employees', label: 'Employees', icon: Users, badge: employees.length },
    { id: 'billing', label: 'Billing', icon: CreditCard, badge: invoices.filter(i => i.status === 'pending').length },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-nilin-charcoal to-gray-800 rounded-xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{account.companyName}</h1>
              <p className="text-white/70">{account.companyEmail}</p>
            </div>
          </div>
          <div className={cn('px-3 py-1 rounded-full text-sm font-medium capitalize', statusColors[account.status].bg, statusColors[account.status].text)}>
            {account.status}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-white/70 text-sm">Credit Limit</p>
            <p className="text-xl font-bold">{formatPrice(account.creditLimit)}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-white/70 text-sm">Current Balance</p>
            <p className="text-xl font-bold">{formatPrice(account.currentBalance)}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-white/70 text-sm">Employees</p>
            <p className="text-xl font-bold">{account.employeeCount}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-white/70 text-sm">Payment Terms</p>
            <p className="text-xl font-bold capitalize">{account.paymentTerms}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-nilin-coral text-white'
                : 'bg-white text-nilin-gray hover:bg-gray-50 border border-gray-200'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.badge ? (
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs',
                activeTab === tab.id ? 'bg-white/20' : 'bg-gray-100'
              )}>
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Credit Utilization */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-nilin-charcoal mb-4">Credit Utilization</h3>
            <div className="relative h-4 bg-gray-200 rounded-full mb-2">
              <div
                className={cn(
                  'absolute left-0 top-0 h-full rounded-full transition-all',
                  creditUtilization > 80 ? 'bg-red-500' : creditUtilization > 60 ? 'bg-amber-500' : 'bg-green-500'
                )}
                style={{ width: `${Math.min(100, creditUtilization)}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-nilin-gray">Used: {formatPrice(account.currentBalance)}</span>
              <span className="text-nilin-gray">Limit: {formatPrice(account.creditLimit)}</span>
            </div>
            <p className="text-center text-sm text-nilin-gray mt-2">
              {creditUtilization.toFixed(1)}% utilized
            </p>
          </div>

          {/* Spending Limit */}
          {account.spendingLimit && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-semibold text-nilin-charcoal mb-4">Spending Limits</h3>
              <div className="space-y-3">
                {account.spendingLimit.monthly && (
                  <div className="flex justify-between">
                    <span className="text-nilin-gray">Monthly Limit</span>
                    <span className="font-medium">{formatPrice(account.spendingLimit.monthly)}</span>
                  </div>
                )}
                {account.spendingLimit.perTransaction && (
                  <div className="flex justify-between">
                    <span className="text-nilin-gray">Per Transaction</span>
                    <span className="font-medium">{formatPrice(account.spendingLimit.perTransaction)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Invoices */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-nilin-charcoal">Recent Invoices</h3>
              <button className="text-sm text-nilin-coral hover:underline">View All</button>
            </div>
            <div className="space-y-3">
              {invoices.slice(0, 3).map(invoice => (
                <div key={invoice.invoiceId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-nilin-charcoal">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-nilin-gray">{invoice.period}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatPrice(invoice.totalAmount)}</p>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full capitalize',
                      invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                      invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    )}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-nilin-charcoal mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                <UserPlus className="h-5 w-5 text-nilin-coral" />
                <span className="text-sm font-medium">Add Employee</span>
              </button>
              <button className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                <Download className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium">Export Report</span>
              </button>
              <button className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                <FileText className="h-5 w-5 text-purple-500" />
                <span className="text-sm font-medium">View Usage</span>
              </button>
              <button className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                <Phone className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">Contact Support</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'employees' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-gray" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none"
              />
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowAddEmployee(true)}
                className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition"
              >
                <Plus className="h-4 w-4" />
                Add Employee
              </button>
            )}
          </div>

          {/* Employee List */}
          <div className="divide-y divide-gray-100">
            {filteredEmployees.map(employee => (
              <div key={employee.employeeId} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {employee.firstName[0]}{employee.lastName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-nilin-charcoal">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', roleColors[employee.role].bg, roleColors[employee.role].text)}>
                        {employee.role}
                      </span>
                    </div>
                    <p className="text-sm text-nilin-gray">{employee.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {employee.spendingLimit && (
                    <div className="text-right">
                      <p className="text-sm text-nilin-gray">Limit</p>
                      <p className="font-medium text-nilin-charcoal">{formatPrice(employee.spendingLimit)}</p>
                    </div>
                  )}
                  {isAdmin && (
                    <button className="p-2 hover:bg-gray-200 rounded-lg">
                      <MoreVertical className="h-4 w-4 text-nilin-gray" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredEmployees.length === 0 && (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-nilin-gray">No employees found</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-sm text-nilin-gray">Outstanding Balance</p>
              <p className="text-2xl font-bold text-nilin-charcoal">
                {formatPrice(invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + i.totalAmount, 0))}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-sm text-nilin-gray">This Month's Usage</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatPrice(invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.totalAmount, 0))}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-sm text-nilin-gray">Next Payment Due</p>
              <p className="text-2xl font-bold text-amber-600">
                {invoices.filter(i => i.status === 'pending').sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0]
                  ? formatDate(invoices.filter(i => i.status === 'pending')[0].dueDate)
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Invoice List */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-nilin-charcoal">Invoices</h3>
              <button className="flex items-center gap-2 text-sm text-nilin-coral hover:underline">
                <Download className="h-4 w-4" />
                Download All
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {invoices.map(invoice => (
                <div key={invoice.invoiceId} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <FileText className="h-5 w-5 text-nilin-gray" />
                    </div>
                    <div>
                      <p className="font-medium text-nilin-charcoal">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-nilin-gray">Due: {formatDate(invoice.dueDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatPrice(invoice.totalAmount)}</p>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full capitalize',
                        invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                        invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      )}>
                        {invoice.status}
                      </span>
                    </div>
                    {invoice.status === 'pending' && (
                      <button className="px-3 py-1.5 bg-nilin-coral text-white text-sm rounded-lg hover:bg-nilin-coral/90">
                        Pay Now
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-semibold text-nilin-charcoal mb-4">Account Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-nilin-charcoal">Spending Limits</p>
                <p className="text-sm text-nilin-gray">Set monthly and per-transaction limits</p>
              </div>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Edit</button>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-nilin-charcoal">Payment Terms</p>
                <p className="text-sm text-nilin-gray">Current: {account.paymentTerms}</p>
              </div>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Change</button>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-nilin-charcoal">Billing Email</p>
                <p className="text-sm text-nilin-gray">{account.companyEmail}</p>
              </div>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Update</button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-nilin-charcoal">Auto-Renew</p>
                <p className="text-sm text-nilin-gray">Automatically renew the account</p>
              </div>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Configure</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Add New Employee</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">First Name</label>
                  <input
                    type="text"
                    value={newEmployee.firstName}
                    onChange={(e) => setNewEmployee({ ...newEmployee, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">Last Name</label>
                  <input
                    type="text"
                    value={newEmployee.lastName}
                    onChange={(e) => setNewEmployee({ ...newEmployee, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">Email</label>
                <input
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">Role</label>
                <select
                  value={newEmployee.role}
                  onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value as EmployeeRole })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none"
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">Spending Limit (optional)</label>
                <input
                  type="number"
                  value={newEmployee.spendingLimit || ''}
                  onChange={(e) => setNewEmployee({
                    ...newEmployee,
                    spendingLimit: e.target.value ? Number(e.target.value) : undefined
                  })}
                  placeholder="No limit"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddEmployee(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg font-medium text-nilin-gray hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEmployee}
                className="flex-1 py-2 bg-nilin-coral text-white rounded-lg font-medium hover:bg-nilin-coral/90"
              >
                Add Employee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorporateDashboard;
