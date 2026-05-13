import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import PageLayout from '../layout/PageLayout';
import { toast } from 'react-hot-toast';
import {
  Gift,
  Plus,
  Edit3,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Filter,
  X,
  Save,
  Calendar,
  Tag,
  Percent,
  DollarSign,
  Users,
  Clock,
  AlertCircle
} from 'lucide-react';

interface Offer {
  _id: string;
  title: string;
  description?: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_service';
  value: number;
  maxDiscount?: number;
  minOrderValue: number;
  displayTitle?: string;
  displaySubtitle?: string;
  displayGradient?: string;
  displayBadge?: string;
  imageUrl?: string;
  featured?: boolean;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
  maxUses: number;
  currentUses: number;
  createdAt: string;
  applicableServices?: string[];
  applicableCategories?: string[];
}

interface ServiceOption {
  _id: string;
  name: string;
  category?: { name: string };
}

interface CategoryOption {
  _id: string;
  name: string;
}

const AdminOffersManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user, tokens } = useAuthStore();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showServiceSelector, setShowServiceSelector] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    displayTitle: '',
    displaySubtitle: '',
    description: '',
    code: '',
    type: 'percentage' as 'percentage' | 'fixed' | 'free_service',
    value: 0,
    maxDiscount: 0,
    minOrderValue: 0,
    maxUses: 100,
    validFrom: '',
    validUntil: '',
    displayBadge: '',
    displayGradient: 'from-nilin-rose to-nilin-coral',
    featured: false,
    applicableServices: [] as string[],
    applicableCategories: [] as string[],
  });

  useEffect(() => {
    loadOffers();
    loadServicesAndCategories();
  }, []);

  const loadServicesAndCategories = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = tokens?.accessToken || '';

      const [servicesRes, categoriesRes] = await Promise.all([
        fetch(`${API_URL}/services?limit=100`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const servicesData = await servicesRes.json();
      const categoriesData = await categoriesRes.json();

      if (servicesData.success) {
        setServices(servicesData.data?.services || servicesData.data || []);
      }
      if (categoriesData.success) {
        setCategories(categoriesData.data?.categories || categoriesData.data || []);
      }
    } catch (error) {
      console.error('Failed to load services/categories:', error);
    }
  };

  const toggleService = (serviceId: string) => {
    setFormData(prev => ({
      ...prev,
      applicableServices: prev.applicableServices.includes(serviceId)
        ? prev.applicableServices.filter(id => id !== serviceId)
        : [...prev.applicableServices, serviceId]
    }));
  };

  const toggleCategory = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      applicableCategories: prev.applicableCategories.includes(categoryId)
        ? prev.applicableCategories.filter(id => id !== categoryId)
        : [...prev.applicableCategories, categoryId]
    }));
  };

  const loadOffers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/offers/admin/all`, {
        headers: {
          'Authorization': `Bearer ${tokens?.accessToken || ''}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setOffers(data.data);
      }
    } catch (error) {
      console.error('Failed to load offers:', error);
      toast.error('Failed to load offers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const url = editingOffer
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/offers/admin/${editingOffer._id}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/offers/admin`;

      const response = await fetch(url, {
        method: editingOffer ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens?.accessToken || ''}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(editingOffer ? 'Offer updated successfully' : 'Offer created successfully');
        setShowModal(false);
        setEditingOffer(null);
        loadOffers();
      } else {
        toast.error(data.message || 'Failed to save offer');
      }
    } catch (error) {
      toast.error('Failed to save offer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (offer: Offer) => {
    setEditingOffer(offer);
    setFormData({
      title: offer.title,
      displayTitle: offer.displayTitle || '',
      displaySubtitle: offer.displaySubtitle || '',
      description: offer.description || '',
      code: offer.code,
      type: offer.type,
      value: offer.value,
      maxDiscount: offer.maxDiscount || 0,
      minOrderValue: offer.minOrderValue,
      maxUses: offer.maxUses,
      validFrom: new Date(offer.validFrom).toISOString().split('T')[0],
      validUntil: new Date(offer.validUntil).toISOString().split('T')[0],
      displayBadge: offer.displayBadge || '',
      displayGradient: offer.displayGradient || 'from-nilin-rose to-nilin-coral',
      featured: offer.featured || false,
      applicableServices: offer.applicableServices || [],
      applicableCategories: offer.applicableCategories || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (offerId: string) => {
    if (!confirm('Are you sure you want to delete this offer?')) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/offers/admin/${offerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${tokens?.accessToken || ''}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Offer deleted successfully');
        loadOffers();
      } else {
        toast.error(data.message || 'Failed to delete offer');
      }
    } catch (error) {
      toast.error('Failed to delete offer');
    }
  };

  const handleToggleActive = async (offer: Offer) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/offers/admin/${offer._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens?.accessToken || ''}`,
        },
        body: JSON.stringify({ isActive: !offer.isActive }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Offer ${offer.isActive ? 'deactivated' : 'activated'} successfully`);
        loadOffers();
      } else {
        toast.error(data.message || 'Failed to update offer');
      }
    } catch (error) {
      toast.error('Failed to update offer');
    }
  };

  const filteredOffers = offers.filter(offer => {
    const matchesSearch = offer.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || offer.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'percentage': return <Percent className="w-4 h-4" />;
      case 'fixed': return <DollarSign className="w-4 h-4" />;
      case 'free_service': return <Gift className="w-4 h-4" />;
      default: return <Tag className="w-4 h-4" />;
    }
  };

  return (
    <PageLayout>
      <div className="min-h-screen bg-nilin-cream py-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-nilin-rose to-nilin-coral flex items-center justify-center">
                  <Gift className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl font-serif text-nilin-charcoal">Offers Management</h1>
              </div>
              <p className="text-nilin-warmGray">Create and manage promotional offers</p>
            </div>
            <button
              onClick={() => {
                setEditingOffer(null);
                setFormData({
                  title: '',
                  displayTitle: '',
                  displaySubtitle: '',
                  description: '',
                  code: '',
                  type: 'percentage',
                  value: 0,
                  maxDiscount: 0,
                  minOrderValue: 0,
                  maxUses: 100,
                  validFrom: new Date().toISOString().split('T')[0],
                  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  displayBadge: '',
                  displayGradient: 'from-nilin-rose to-nilin-coral',
                  featured: false,
                  applicableServices: [],
                  applicableCategories: [],
                });
                setShowModal(true);
              }}
              className="btn-nilin flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Offer
            </button>
          </div>

          {/* Filters */}
          <div className="glass-nilin rounded-nilin-lg p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                <input
                  type="text"
                  placeholder="Search offers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border-2 border-nilin-border bg-white/80 focus:border-nilin-coral focus:outline-none"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 rounded-xl border-2 border-nilin-border bg-white/80 focus:border-nilin-coral focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
                <option value="free_service">Free Service</option>
              </select>
            </div>
          </div>

          {/* Offers Grid */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="glass-nilin rounded-nilin-lg p-12 text-center">
              <Gift className="w-16 h-16 text-nilin-warmGray mx-auto mb-4" />
              <h3 className="text-xl font-medium text-nilin-charcoal mb-2">No offers found</h3>
              <p className="text-nilin-warmGray">Create your first offer to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOffers.map((offer) => (
                <div
                  key={offer._id}
                  className={`glass-nilin rounded-nilin-lg overflow-hidden hover-lift transition-all ${
                    !offer.isActive ? 'opacity-60' : ''
                  }`}
                >
                  <div className={`h-32 bg-gradient-to-br ${offer.displayGradient || 'from-nilin-rose to-nilin-coral'} p-4 relative`}>
                    {offer.displayBadge && (
                      <span className="absolute top-3 left-3 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-medium">
                        {offer.displayBadge}
                      </span>
                    )}
                    <div className="absolute bottom-3 right-3">
                      <button
                        onClick={() => handleToggleActive(offer)}
                        className="p-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
                      >
                        {offer.isActive ? (
                          <ToggleRight className="w-6 h-6 text-white" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-white/60" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-nilin-charcoal">
                          {offer.displayTitle || offer.title}
                        </h3>
                        {offer.displayTitle && (
                          <p className="text-sm text-nilin-warmGray">{offer.title}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 bg-nilin-blush rounded-full">
                        {getTypeIcon(offer.type)}
                        <span className="text-sm font-medium text-nilin-coral">
                          {offer.type === 'percentage'
                            ? `${offer.value}%`
                            : offer.type === 'fixed'
                            ? `AED ${offer.value}`
                            : 'Free'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-nilin-warmGray mb-3 line-clamp-2">
                      {offer.displaySubtitle || offer.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-nilin-lightGray mb-3">
                      <Tag className="w-3 h-3" />
                      <code className="font-mono bg-nilin-muted px-2 py-1 rounded">{offer.code}</code>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-nilin-lightGray mb-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(offer.validFrom)} - {formatDate(offer.validUntil)}
                      </div>
                    </div>
                    {(offer.applicableServices?.length ?? 0) > 0 || (offer.applicableCategories?.length ?? 0) > 0 ? (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {offer.applicableServices?.slice(0, 2).map((serviceId, idx) => (
                          <span key={`svc-${serviceId}-${idx}`} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                            Service linked
                          </span>
                        ))}
                        {offer.applicableCategories?.slice(0, 2).map((catId, idx) => (
                          <span key={`cat-${catId}-${idx}`} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                            Category linked
                          </span>
                        ))}
                        {((offer.applicableServices?.length ?? 0) + (offer.applicableCategories?.length ?? 0)) > 4 && (
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                            +{((offer.applicableServices?.length ?? 0) + (offer.applicableCategories?.length ?? 0) - 4)}
                          </span>
                        )}
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between text-xs text-nilin-lightGray mb-4">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {offer.currentUses} / {offer.maxUses} used
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {offer.validUntil && new Date(offer.validUntil) < new Date() ? (
                          <span className="text-red-500">Expired</span>
                        ) : (
                          `${Math.ceil((new Date(offer.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days left`
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(offer)}
                        className="flex-1 btn-nilin py-2 text-sm flex items-center justify-center gap-1"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(offer._id)}
                        className="px-3 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-nilin-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-serif text-nilin-charcoal">
                {editingOffer ? 'Edit Offer' : 'Create New Offer'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-nilin-muted rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                    placeholder="e.g., Summer Sale 20% Off"
                  />
                </div>

                {/* Display Title & Subtitle */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Display Title
                    </label>
                    <input
                      type="text"
                      value={formData.displayTitle}
                      onChange={(e) => setFormData({ ...formData, displayTitle: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                      placeholder="For homepage banner"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Display Subtitle
                    </label>
                    <input
                      type="text"
                      value={formData.displaySubtitle}
                      onChange={(e) => setFormData({ ...formData, displaySubtitle: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                      placeholder="Subtitle text"
                    />
                  </div>
                </div>

                {/* Code */}
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    Promo Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none font-mono"
                    placeholder="e.g., SUMMER20"
                  />
                </div>

                {/* Type & Value */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Type *
                    </label>
                    <select
                      required
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed Amount (AED)</option>
                      <option value="free_service">Free Service</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                      {formData.type === 'percentage' ? 'Discount %' : formData.type === 'fixed' ? 'Amount (AED)' : 'Value'}
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                    />
                  </div>
                </div>

                {/* Max Discount & Min Order */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Max Discount (AED)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.maxDiscount}
                      onChange={(e) => setFormData({ ...formData, maxDiscount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                      placeholder="0 for no limit"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Min Order (AED)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.minOrderValue}
                      onChange={(e) => setFormData({ ...formData, minOrderValue: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Valid From *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.validFrom}
                      onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Valid Until *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.validUntil}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                    />
                  </div>
                </div>

                {/* Max Uses & Badge */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Max Uses
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.maxUses}
                      onChange={(e) => setFormData({ ...formData, maxUses: parseInt(e.target.value) || 100 })}
                      className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Badge
                    </label>
                    <select
                      value={formData.displayBadge}
                      onChange={(e) => setFormData({ ...formData, displayBadge: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                    >
                      <option value="">None</option>
                      <option value="Limited Time">Limited Time</option>
                      <option value="New">New</option>
                      <option value="Popular">Popular</option>
                      <option value="Hot">Hot</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none resize-none"
                    placeholder="Detailed description of the offer"
                  />
                </div>

                {/* Applicable Services */}
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Applicable Services
                    <span className="text-nilin-warmGray font-normal ml-1">(Leave empty for all services)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowServiceSelector(!showServiceSelector)}
                    className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none text-left flex items-center justify-between"
                  >
                    <span className="text-nilin-warmGray">
                      {formData.applicableServices.length === 0
                        ? 'All services'
                        : `${formData.applicableServices.length} service(s) selected`}
                    </span>
                    <span className="text-nilin-coral">{showServiceSelector ? '▲' : '▼'}</span>
                  </button>
                  {showServiceSelector && (
                    <div className="mt-2 p-3 bg-nilin-muted rounded-xl max-h-48 overflow-y-auto">
                      {services.length === 0 ? (
                        <p className="text-sm text-nilin-warmGray text-center py-2">No services available</p>
                      ) : (
                        services.map(service => (
                          <label key={service._id} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-white rounded px-2">
                            <input
                              type="checkbox"
                              checked={formData.applicableServices.includes(service._id)}
                              onChange={() => toggleService(service._id)}
                              className="w-4 h-4 rounded border-nilin-border text-nilin-coral"
                            />
                            <span className="text-sm text-nilin-charcoal">
                              {service.name}
                              {service.category?.name && (
                                <span className="text-nilin-warmGray ml-1">({service.category.name})</span>
                              )}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Applicable Categories */}
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Applicable Categories
                    <span className="text-nilin-warmGray font-normal ml-1">(Leave empty for all categories)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCategorySelector(!showCategorySelector)}
                    className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none text-left flex items-center justify-between"
                  >
                    <span className="text-nilin-warmGray">
                      {formData.applicableCategories.length === 0
                        ? 'All categories'
                        : `${formData.applicableCategories.length} category(ies) selected`}
                    </span>
                    <span className="text-nilin-coral">{showCategorySelector ? '▲' : '▼'}</span>
                  </button>
                  {showCategorySelector && (
                    <div className="mt-2 p-3 bg-nilin-muted rounded-xl max-h-48 overflow-y-auto">
                      {categories.length === 0 ? (
                        <p className="text-sm text-nilin-warmGray text-center py-2">No categories available</p>
                      ) : (
                        categories.map(category => (
                          <label key={category._id} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-white rounded px-2">
                            <input
                              type="checkbox"
                              checked={formData.applicableCategories.includes(category._id)}
                              onChange={() => toggleCategory(category._id)}
                              className="w-4 h-4 rounded border-nilin-border text-nilin-coral"
                            />
                            <span className="text-sm text-nilin-charcoal">{category.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Featured */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="w-5 h-5 rounded border-nilin-border text-nilin-coral focus:ring-nilin-coral"
                  />
                  <label htmlFor="featured" className="text-sm font-medium text-nilin-charcoal">
                    Feature this offer on homepage
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl border-2 border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 btn-nilin flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {editingOffer ? 'Update Offer' : 'Create Offer'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default AdminOffersManagement;
