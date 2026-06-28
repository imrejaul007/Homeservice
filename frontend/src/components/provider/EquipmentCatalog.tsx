import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Search,
  Filter,
  Plus,
  Minus,
  Calendar,
  MapPin,
  Star,
  Shield,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

type EquipmentCategory = 'cleaning' | 'plumbing' | 'electrical' | 'landscaping' | 'construction' | 'general';
type RentalStatus = 'available' | 'rented' | 'reserved' | 'maintenance' | 'retired';

interface Equipment {
  _id: string;
  equipmentId: string;
  name: string;
  description: string;
  category: EquipmentCategory;
  manufacturer?: string;
  model?: string;
  condition: 'new' | 'good' | 'fair' | 'needs_repair';
  images: string[];
  dailyRate: number;
  weeklyRate?: number;
  monthlyRate?: number;
  depositAmount: number;
  depositRefundable: boolean;
  maxRentalDays: number;
  minRentalDays: number;
  requiresLicense?: string;
  requiresTraining: boolean;
  status: RentalStatus;
  location?: {
    address?: string;
    distance?: number;
  };
  rating?: number;
  reviewCount?: number;
}

interface EquipmentCatalogProps {
  providerId?: string;
  onAddEquipment?: (equipment: Partial<Equipment>) => void;
  onEditEquipment?: (equipment: Equipment) => void;
  onRentEquipment?: (equipment: Equipment, rentalDays: number) => void;
  isProviderView?: boolean;
}

const categoryIcons: Record<EquipmentCategory, React.ReactNode> = {
  cleaning: <Wrench className="h-5 w-5" />,
  plumbing: <Wrench className="h-5 w-5" />,
  electrical: <Wrench className="h-5 w-5" />,
  landscaping: <Wrench className="h-5 w-5" />,
  construction: <Wrench className="h-5 w-5" />,
  general: <Wrench className="h-5 w-5" />,
};

const categoryLabels: Record<EquipmentCategory, string> = {
  cleaning: 'Cleaning Equipment',
  plumbing: 'Plumbing Tools',
  electrical: 'Electrical Equipment',
  landscaping: 'Landscaping Tools',
  construction: 'Construction Equipment',
  general: 'General Tools',
};

const conditionLabels: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: 'text-green-600 bg-green-100' },
  good: { label: 'Good', color: 'text-blue-600 bg-blue-100' },
  fair: { label: 'Fair', color: 'text-amber-600 bg-amber-100' },
  needs_repair: { label: 'Needs Repair', color: 'text-red-600 bg-red-100' },
};

const EquipmentCatalog: React.FC<EquipmentCatalogProps> = ({
  providerId,
  onAddEquipment,
  onEditEquipment,
  onRentEquipment,
  isProviderView = false,
}) => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [filteredEquipment, setFilteredEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<EquipmentCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'price' | 'name' | 'rating'>('price');
  const [expandedEquipment, setExpandedEquipment] = useState<string | null>(null);
  const [rentalDays, setRentalDays] = useState<Record<string, number>>({});

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(price);
  };

  useEffect(() => {
    const fetchEquipment = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await api.get('/equipment/catalog', {
          params: {
            ...(providerId ? { providerId } : {}),
            limit: 100,
          },
        });

        const items = (response.data.data.equipment || []).map((item: Equipment & { _id?: string }) => ({
          ...item,
          _id: item._id?.toString?.() || item.equipmentId,
        }));

        setEquipment(items);
        setFilteredEquipment(items);
      } catch (err) {
        setEquipment([]);
        setFilteredEquipment([]);
        setLoadError(err instanceof Error ? err.message : 'Failed to load equipment catalog');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEquipment();
  }, [providerId]);

  // Filter and sort equipment
  useEffect(() => {
    let filtered = [...equipment];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(eq => eq.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(eq =>
        eq.name.toLowerCase().includes(query) ||
        eq.description.toLowerCase().includes(query) ||
        eq.manufacturer?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.dailyRate - b.dailyRate;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        default:
          return 0;
      }
    });

    setFilteredEquipment(filtered);
  }, [equipment, selectedCategory, searchQuery, sortBy]);

  const calculateRentalPrice = (item: Equipment, days: number) => {
    let basePrice = item.dailyRate * days;

    if (days >= 7 && item.weeklyRate) {
      const weeks = Math.floor(days / 7);
      const remainingDays = days % 7;
      basePrice = (weeks * item.weeklyRate) + (remainingDays * item.dailyRate);
    } else if (days >= 30 && item.monthlyRate) {
      const months = Math.floor(days / 30);
      const remainingDays = days % 30;
      basePrice = (months * item.monthlyRate) + (remainingDays * item.dailyRate);
    }

    const deposit = item.depositAmount;
    const subtotal = basePrice;
    const taxes = basePrice * 0.05;
    const total = basePrice + taxes + (item.depositRefundable ? 0 : deposit);

    return { basePrice, deposit, subtotal, taxes, total };
  };

  const toggleExpand = (id: string) => {
    setExpandedEquipment(expandedEquipment === id ? null : id);
  };

  const adjustRentalDays = (id: string, delta: number) => {
    const item = equipment.find(eq => eq._id === id);
    if (!item) return;

    const current = rentalDays[id] || item.minRentalDays;
    const newDays = Math.max(item.minRentalDays, Math.min(item.maxRentalDays, current + delta));
    setRentalDays({ ...rentalDays, [id]: newDays });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-4 border-nilin-coral/30 border-t-nilin-coral rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-700">{loadError}</p>
      </div>
    );
  }

  if (equipment.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-10 text-center">
        <Wrench className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-nilin-charcoal">No equipment listed yet</p>
        <p className="text-sm text-nilin-gray mt-1">
          {isProviderView
            ? 'Add equipment to your catalog to make it available for rental.'
            : 'Check back later for available rental equipment.'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-nilin-charcoal">Equipment Catalog</h2>
          <p className="text-nilin-gray">{equipment.length} items available</p>
        </div>
        {isProviderView && onAddEquipment && (
          <button
            onClick={() => onAddEquipment({})}
            className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition"
          >
            <Plus className="h-5 w-5" />
            Add Equipment
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-nilin-gray" />
          <input
            type="text"
            placeholder="Search equipment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as EquipmentCategory | 'all')}
            className="appearance-none px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none bg-white"
          >
            <option value="all">All Categories</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-gray pointer-events-none" />
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'price' | 'name' | 'rating')}
            className="appearance-none px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none bg-white"
          >
            <option value="price">Sort by Price</option>
            <option value="name">Sort by Name</option>
            <option value="rating">Sort by Rating</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-gray pointer-events-none" />
        </div>
      </div>

      {/* Equipment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredEquipment.map((item) => {
          const days = rentalDays[item._id] || item.minRentalDays;
          const pricing = calculateRentalPrice(item, days);
          const isExpanded = expandedEquipment === item._id;
          const conditionInfo = conditionLabels[item.condition];

          return (
            <div
              key={item._id}
              className={cn(
                'bg-white rounded-xl border transition-all',
                isExpanded ? 'border-nilin-coral shadow-lg' : 'border-gray-200'
              )}
            >
              {/* Equipment Header */}
              <div className="p-4">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-14 h-14 rounded-xl flex items-center justify-center',
                    item.status === 'available' ? 'bg-green-100' : 'bg-gray-100'
                  )}>
                    {categoryIcons[item.category]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium capitalize',
                        conditionInfo.color
                      )}>
                        {conditionInfo.label}
                      </span>
                      {item.status === 'available' ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          Available
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          {item.status}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-nilin-charcoal truncate">{item.name}</h3>
                    <p className="text-sm text-nilin-gray line-clamp-2">{item.description}</p>
                  </div>
                </div>

                {/* Quick Info */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-nilin-gray">Daily Rate</p>
                      <p className="text-lg font-bold text-nilin-charcoal">{formatPrice(item.dailyRate)}</p>
                    </div>
                    {item.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                        <span className="font-medium">{item.rating}</span>
                        <span className="text-sm text-nilin-gray">({item.reviewCount})</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleExpand(item._id)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-nilin-gray" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-nilin-gray" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {item.manufacturer && (
                      <div>
                        <p className="text-xs text-nilin-gray">Manufacturer</p>
                        <p className="text-sm font-medium">{item.manufacturer}</p>
                      </div>
                    )}
                    {item.model && (
                      <div>
                        <p className="text-xs text-nilin-gray">Model</p>
                        <p className="text-sm font-medium">{item.model}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-nilin-gray">Min. Rental</p>
                      <p className="text-sm font-medium">{item.minRentalDays} day{item.minRentalDays > 1 ? 's' : ''}</p>
                    </div>
                    <div>
                      <p className="text-xs text-nilin-gray">Max. Rental</p>
                      <p className="text-sm font-medium">{item.maxRentalDays} days</p>
                    </div>
                    <div>
                      <p className="text-xs text-nilin-gray">Deposit</p>
                      <p className="text-sm font-medium">{formatPrice(item.depositAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-nilin-gray">Refundable</p>
                      <p className="text-sm font-medium">{item.depositRefundable ? 'Yes' : 'No'}</p>
                    </div>
                  </div>

                  {/* Warnings */}
                  {(item.requiresLicense || item.requiresTraining) && (
                    <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div className="text-sm">
                          {item.requiresLicense && (
                            <p className="text-amber-800">Requires: {item.requiresLicense}</p>
                          )}
                          {item.requiresTraining && (
                            <p className="text-amber-800">Training required before use</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  {item.location?.address && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-nilin-gray">
                      <MapPin className="h-4 w-4" />
                      {item.location.address}
                      {item.location.distance && ` (${item.location.distance}km away)`}
                    </div>
                  )}

                  {/* Rental Days Selector */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-nilin-charcoal">Rental Duration</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => adjustRentalDays(item._id, -1)}
                          disabled={days <= item.minRentalDays}
                          className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-20 text-center font-medium">{days} day{days > 1 ? 's' : ''}</span>
                        <button
                          onClick={() => adjustRentalDays(item._id, 1)}
                          disabled={days >= item.maxRentalDays}
                          className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Price Breakdown */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-nilin-gray">Rental ({days} days)</span>
                          <span>{formatPrice(pricing.basePrice)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-nilin-gray">VAT (5%)</span>
                          <span>{formatPrice(pricing.taxes)}</span>
                        </div>
                        {item.depositRefundable && (
                          <div className="flex justify-between text-blue-600">
                            <span>Refundable Deposit</span>
                            <span>{formatPrice(pricing.deposit)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold pt-2 border-t border-gray-200">
                          <span>Total</span>
                          <span className="text-nilin-coral">{formatPrice(pricing.total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {isProviderView && onEditEquipment ? (
                        <button
                          onClick={() => onEditEquipment(item)}
                          className="flex-1 py-2.5 border border-gray-300 rounded-lg font-medium text-nilin-gray hover:bg-gray-50 transition"
                        >
                          Edit Equipment
                        </button>
                      ) : (
                        <button
                          onClick={() => onRentEquipment?.(item, days)}
                          disabled={item.status !== 'available'}
                          className={cn(
                            'flex-1 py-2.5 rounded-lg font-medium transition',
                            item.status === 'available'
                              ? 'bg-nilin-coral text-white hover:bg-nilin-coral/90'
                              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          )}
                        >
                          {item.status === 'available' ? 'Rent Now' : 'Not Available'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredEquipment.length === 0 && (
        <div className="text-center py-12">
          <Wrench className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-nilin-charcoal mb-2">No equipment found</h3>
          <p className="text-nilin-gray">Try adjusting your filters or search query</p>
        </div>
      )}
    </div>
  );
};

export default EquipmentCatalog;
