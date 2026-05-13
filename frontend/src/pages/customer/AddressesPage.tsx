import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronRight,
  AlertCircle,
  Home,
  Building,
  Briefcase,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { customerApi, type Address } from '../../services/customerApi';

const AddressesPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    label: '',
    street: '',
    city: '',
    state: '',
    country: 'UAE',
    zipCode: '',
    isDefault: false,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: '/customer/addresses' } });
      return;
    }
    fetchAddresses();
  }, [isAuthenticated]);

  const fetchAddresses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await customerApi.getAddresses();
      setAddresses(response.data.addresses);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load addresses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (editingAddress) {
        await customerApi.updateAddress(editingAddress._id, formData);
      } else {
        await customerApi.addAddress(formData);
      }
      setShowForm(false);
      setEditingAddress(null);
      resetForm();
      fetchAddresses();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
      await customerApi.deleteAddress(addressId);
      fetchAddresses();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete address');
    }
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      label: address.label,
      street: address.street,
      city: address.city,
      state: address.state || '',
      country: address.country,
      zipCode: address.zipCode || '',
      isDefault: address.isDefault,
    });
    setShowForm(true);
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      await customerApi.setDefaultAddress(addressId);
      fetchAddresses();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to set default address');
    }
  };

  const resetForm = () => {
    setFormData({
      label: '',
      street: '',
      city: '',
      state: '',
      country: 'UAE',
      zipCode: '',
      isDefault: false,
    });
  };

  const getLabelIcon = (label: string) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('home')) return <Home className="w-5 h-5" />;
    if (lowerLabel.includes('work') || lowerLabel.includes('office')) return <Briefcase className="w-5 h-5" />;
    if (lowerLabel.includes('business')) return <Building className="w-5 h-5" />;
    return <MapPin className="w-5 h-5" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-nilin-coral" />
              </div>
              <div>
                <h1 className="text-3xl font-serif text-nilin-charcoal">My Addresses</h1>
                <p className="text-nilin-warmGray">Manage your saved addresses</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingAddress(null);
                resetForm();
                setShowForm(true);
              }}
              className="btn-nilin flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Address
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-nilin bg-red-50 border border-red-200 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          {/* Add/Edit Form */}
          {showForm && (
            <div className="glass-nilin rounded-nilin-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-xl text-nilin-charcoal">
                  {editingAddress ? 'Edit Address' : 'Add New Address'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingAddress(null);
                    resetForm();
                  }}
                  className="p-2 rounded-full hover:bg-nilin-muted transition-colors"
                >
                  <X className="w-5 h-5 text-nilin-warmGray" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                      Label (e.g., Home, Work)
                    </label>
                    <input
                      type="text"
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                      className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
                      placeholder="Home, Work, etc."
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
                      placeholder="Dubai, Abu Dhabi, etc."
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
                    placeholder="Building, street, area"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                      State/Emirate
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
                      placeholder="Dubai"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                      className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
                      placeholder="12345"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isDefault: !formData.isDefault })}
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                      formData.isDefault
                        ? 'bg-nilin-coral border-nilin-coral'
                        : 'border-nilin-border hover:border-nilin-coral'
                    }`}
                  >
                    {formData.isDefault && <Check className="w-4 h-4 text-white" />}
                  </button>
                  <span className="text-sm text-nilin-charcoal">Set as default address</span>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="submit" disabled={isSaving} className="btn-nilin flex-1">
                    {isSaving ? 'Saving...' : editingAddress ? 'Update Address' : 'Add Address'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingAddress(null);
                      resetForm();
                    }}
                    className="flex-1 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Addresses List */}
          {addresses.length === 0 && !showForm ? (
            <div className="glass-nilin rounded-nilin-lg p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-10 h-10 text-nilin-coral" />
              </div>
              <h3 className="text-xl font-serif text-nilin-charcoal mb-2">No addresses yet</h3>
              <p className="text-nilin-warmGray mb-6 max-w-md mx-auto">
                Add your addresses for faster booking. Save home, work, or any other location.
              </p>
              <button onClick={() => setShowForm(true)} className="btn-nilin">
                Add Your First Address
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {addresses.map((address) => (
                <div
                  key={address._id}
                  className="glass-nilin rounded-nilin-lg p-6 hover-lift transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-nilin-coral/20 flex items-center justify-center flex-shrink-0">
                      <div className="text-nilin-coral">{getLabelIcon(address.label)}</div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-nilin-charcoal">{address.label}</h3>
                        {address.isDefault && (
                          <span className="badge-nilin-primary text-xs">Default</span>
                        )}
                      </div>
                      <p className="text-nilin-warmGray text-sm">
                        {address.street}
                        {address.city && `, ${address.city}`}
                        {address.state && `, ${address.state}`}
                        {address.country && `, ${address.country}`}
                        {address.zipCode && ` ${address.zipCode}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(address)}
                        className="p-2 rounded-lg hover:bg-nilin-muted transition-colors text-nilin-warmGray hover:text-nilin-charcoal"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(address._id)}
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors text-nilin-warmGray hover:text-red-500"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      {!address.isDefault && (
                        <button
                          onClick={() => handleSetDefault(address._id)}
                          className="px-3 py-2 rounded-lg text-sm text-nilin-coral hover:bg-nilin-coral/10 transition-colors"
                        >
                          Set Default
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AddressesPage;
