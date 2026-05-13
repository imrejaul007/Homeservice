import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Upload,
  Image,
  Trash2,
  Edit,
  Star,
  ArrowLeft,
  X,
  GripVertical,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';

interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  rating?: number;
  createdAt: Date;
}

// Mock data for demonstration
const mockPortfolio: PortfolioItem[] = [
  {
    id: '1',
    title: 'Bridal Makeup - Sarah',
    description: 'Beautiful bridal makeup for a winter wedding in Dubai',
    imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=300&fit=crop',
    category: 'Makeup',
    rating: 5,
    createdAt: new Date('2024-02-15'),
  },
  {
    id: '2',
    title: 'Hair Styling - Corporate Event',
    description: 'Professional hair styling for 50+ attendees at annual gala',
    imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=300&fit=crop',
    category: 'Hair',
    rating: 5,
    createdAt: new Date('2024-02-10'),
  },
  {
    id: '3',
    title: 'Nail Art Collection',
    description: 'Custom nail art designs featuring Dubai landmarks',
    imageUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=300&fit=crop',
    category: 'Nails',
    rating: 4,
    createdAt: new Date('2024-02-05'),
  },
];

const ProviderPortfolioPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Redirect if not a provider
  React.useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>(mockPortfolio);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    category: 'Hair',
  });
  const [isLoading, setIsLoading] = useState(false);

  const categories = ['Hair', 'Makeup', 'Nails', 'Skin', 'Massage', 'Other'];

  const handleAddItem = () => {
    if (!newItem.title.trim()) return;

    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      const item: PortfolioItem = {
        id: Date.now().toString(),
        title: newItem.title,
        description: newItem.description,
        imageUrl: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=400&h=300&fit=crop',
        category: newItem.category,
        createdAt: new Date(),
      };
      setPortfolioItems([item, ...portfolioItems]);
      setNewItem({ title: '', description: '', category: 'Hair' });
      setShowAddModal(false);
      setIsLoading(false);
    }, 500);
  };

  const handleDeleteItem = (id: string) => {
    if (window.confirm('Are you sure you want to delete this portfolio item?')) {
      setPortfolioItems(portfolioItems.filter((item) => item.id !== id));
    }
  };

  const handleEditItem = (item: PortfolioItem) => {
    setEditingItem(item);
    setNewItem({
      title: item.title,
      description: item.description,
      category: item.category,
    });
    setShowAddModal(true);
  };

  const handleSaveEdit = () => {
    if (!editingItem || !newItem.title.trim()) return;

    setPortfolioItems(
      portfolioItems.map((item) =>
        item.id === editingItem.id
          ? { ...item, title: newItem.title, description: newItem.description, category: newItem.category }
          : item
      )
    );
    setEditingItem(null);
    setNewItem({ title: '', description: '', category: 'Hair' });
    setShowAddModal(false);
  };

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/provider/dashboard')}
              className="flex items-center text-nilin-warmGray hover:text-nilin-charcoal mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </button>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">My Portfolio</h1>
                <p className="text-nilin-warmGray">Showcase your best work to attract more customers</p>
              </div>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setNewItem({ title: '', description: '', category: 'Hair' });
                  setShowAddModal(true);
                }}
                className="btn-nilin flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Work
              </button>
            </div>
          </div>

          {/* Portfolio Grid */}
          {portfolioItems.length === 0 ? (
            <div className="glass-nilin rounded-nilin-lg p-12 text-center">
              <Image className="h-16 w-16 text-nilin-warmGray mx-auto mb-4" />
              <h3 className="text-lg font-medium text-nilin-charcoal mb-2">No Portfolio Items Yet</h3>
              <p className="text-nilin-warmGray mb-6">
                Start adding photos of your work to showcase your skills to potential customers.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-nilin inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Your First Work
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {portfolioItems.map((item) => (
                <div
                  key={item.id}
                  className="glass-nilin rounded-nilin-lg overflow-hidden hover-lift group"
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Category Badge */}
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-nilin-charcoal">
                        {item.category}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditItem(item)}
                        className="p-2 bg-white/90 backdrop-blur-sm rounded-full text-nilin-charcoal hover:bg-white transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 bg-white/90 backdrop-blur-sm rounded-full text-red-500 hover:bg-white transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Rating */}
                    {item.rating && (
                      <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full">
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-medium text-nilin-charcoal">{item.rating}</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-medium text-nilin-charcoal mb-1">{item.title}</h3>
                    <p className="text-sm text-nilin-warmGray line-clamp-2">{item.description}</p>
                    <p className="text-xs text-nilin-warmGray mt-2">
                      {item.createdAt.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tips Section */}
          <div className="mt-8 glass-nilin rounded-nilin-lg p-6">
            <h3 className="text-sm font-medium text-nilin-charcoal mb-3">Tips for a Great Portfolio</h3>
            <ul className="space-y-2 text-sm text-nilin-warmGray">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-nilin-coral mt-1.5 flex-shrink-0" />
                Use high-quality images with good lighting to showcase your work
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-nilin-coral mt-1.5 flex-shrink-0" />
                Include a variety of work to demonstrate your range and skills
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-nilin-coral mt-1.5 flex-shrink-0" />
                Write descriptive captions that highlight your techniques and customer satisfaction
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-nilin-coral mt-1.5 flex-shrink-0" />
                Update your portfolio regularly with your latest and best work
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-nilin-lg max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-serif text-nilin-charcoal">
                {editingItem ? 'Edit Portfolio Item' : 'Add Portfolio Item'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingItem(null);
                }}
                className="p-2 hover:bg-nilin-muted rounded-nilin transition-colors"
              >
                <X className="h-5 w-5 text-nilin-warmGray" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Image Upload Area */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Portfolio Image
                </label>
                <div className="border-2 border-dashed border-nilin-border rounded-nilin-lg p-8 text-center hover:border-nilin-coral transition-colors cursor-pointer">
                  <Upload className="h-8 w-8 text-nilin-warmGray mx-auto mb-2" />
                  <p className="text-sm text-nilin-warmGray">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-nilin-warmGray mt-1">
                    PNG, JPG up to 10MB
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  placeholder="e.g., Bridal Makeup - Sarah's Wedding"
                  className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Category
                </label>
                <select
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Description
                </label>
                <textarea
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  rows={3}
                  placeholder="Describe this work, the techniques used, and customer feedback..."
                  className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={editingItem ? handleSaveEdit : handleAddItem}
                  disabled={!newItem.title.trim() || isLoading}
                  className="flex-1 btn-nilin flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      {editingItem ? 'Save Changes' : 'Add to Portfolio'}
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingItem(null);
                  }}
                  className="px-6 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default ProviderPortfolioPage;
