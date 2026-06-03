import React, { useState, useEffect, useRef } from 'react';
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
  Camera,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { portfolioApi, PortfolioItem, CreatePortfolioItemData } from '../../services/portfolioApi';
import { categoryApi } from '../../services/categoryApi';
import { useToast } from '../../components/common/Toast';

interface PortfolioImage {
  _id?: string;
  url: string;
  caption?: string;
}

interface ImageDeleteState {
  itemId: string;
  imageUrl: string;
}

const ProviderPortfolioPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const toast = useToast();

  // Redirect if not a provider
  useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/provider/dashboard'); // FIX: Was '/dashboard'
    }
  }, [user, navigate]);

  // State
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [imageToDelete, setImageToDelete] = useState<ImageDeleteState | null>(null);
  const [isDeletingImage, setIsDeletingImage] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Hair',
    tags: '',
  });

  // FIX: Categories fetched from API instead of hardcoded
  const [categories, setCategories] = useState<string[]>(['Hair', 'Makeup', 'Nails', 'Skin', 'Massage', 'Spa', 'Other']);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Image upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch portfolio items and categories on mount
  useEffect(() => {
    fetchPortfolio();
    fetchCategories();
  }, []);

  // FIX: Fetch categories from API
  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true);
      const { categories: apiCategories } = await categoryApi.getServiceCategories();
      if (apiCategories && apiCategories.length > 0) {
        setCategories(apiCategories);
        // Set default category to first one from API
        setFormData(prev => ({ ...prev, category: apiCategories[0] }));
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      // Fall back to hardcoded categories
    } finally {
      setCategoriesLoading(false);
    }
  };

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  const fetchPortfolio = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const items = await portfolioApi.getPortfolio();
      setPortfolioItems(items);
    } catch (err: any) {
      console.error('Failed to fetch portfolio:', err);
      setError(err.response?.data?.message || 'Failed to load portfolio');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const validFiles: File[] = [];
    const newPreviews: string[] = [];
    const newErrors: string[] = [];

    Array.from(files).forEach((file) => {
      // Validate file type
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        newErrors.push(`${file.name}: Only JPEG, PNG, and WebP images are allowed`);
        return;
      }
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        newErrors.push(`${file.name}: File size must be less than 10MB`);
        return;
      }
      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    });

    if (newErrors.length > 0) {
      setUploadError(newErrors.join('. '));
      setTimeout(() => setUploadError(null), 5000);
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  // Remove image from selection
  const handleRemoveImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Open modal for adding new item
  const handleOpenAddModal = () => {
    setEditingItem(null);
    // FIX: Use first category from fetched list as default
    setFormData({ title: '', description: '', category: categories[0] || 'Hair', tags: '' });
    setSelectedFiles([]);
    setImagePreviews([]);
    setUploadError(null);
    setShowAddModal(true);
  };

  // Open modal for editing
  const handleEditItem = (item: PortfolioItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || '',
      category: item.category || 'Hair',
      tags: item.tags?.join(', ') || '',
    });
    // Show existing images for edit
    const existingPreviews = item.images?.map((img) => img.url) || [];
    setImagePreviews(existingPreviews);
    setSelectedFiles([]); // New files will be added separately
    setUploadError(null);
    setShowAddModal(true);
  };

  // Delete portfolio item
  const handleDeleteItem = async () => {
    if (!deleteItemId) return;

    try {
      await portfolioApi.deletePortfolioItem(deleteItemId);
      setPortfolioItems((prev) => prev.filter((item) => item._id !== deleteItemId));
      toast.addToast({
        title: 'Deleted',
        description: 'Portfolio item deleted successfully',
        variant: 'success'
      });
    } catch (err: any) {
      console.error('Failed to delete portfolio item:', err);
      toast.addToast({
        title: 'Failed to delete',
        description: err.response?.data?.message || 'Failed to delete portfolio item',
        variant: 'error'
      });
    } finally {
      setShowDeleteModal(false);
      setDeleteItemId(null);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteItemId(id);
    setShowDeleteModal(true);
  };

  // Delete individual image from a portfolio item
  const handleDeleteImage = async () => {
    if (!imageToDelete) return;

    setIsDeletingImage(true);
    try {
      await portfolioApi.removeImage(imageToDelete.itemId, imageToDelete.imageUrl);
      // Update local state to remove the image
      setPortfolioItems((prev) =>
        prev.map((item) => {
          if (item._id === imageToDelete.itemId) {
            return {
              ...item,
              images: item.images.filter((img) => img.url !== imageToDelete.imageUrl),
            };
          }
          return item;
        })
      );
      toast.addToast({
        title: 'Image deleted',
        description: 'Image removed from portfolio item',
        variant: 'success',
      });
    } catch (err: any) {
      console.error('Failed to delete image:', err);
      toast.addToast({
        title: 'Failed to delete image',
        description: err.response?.data?.message || 'Failed to remove image',
        variant: 'error',
      });
    } finally {
      setIsDeletingImage(false);
      setImageToDelete(null);
    }
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.addToast({
        title: 'Validation Error',
        description: 'Title is required',
        variant: 'warning'
      });
      return;
    }

    // If editing, require at least one existing image or new file
    if (editingItem && selectedFiles.length === 0 && imagePreviews.length === 0) {
      toast.addToast({
        title: 'Validation Error',
        description: 'Please add at least one image',
        variant: 'warning'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const tags = formData.tags
        ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      if (editingItem) {
        // Update existing item
        const updateData = {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          tags,
        };

        let updatedItem = await portfolioApi.updatePortfolioItem(editingItem._id, updateData);

        // Upload new images if any
        if (selectedFiles.length > 0) {
          for (const file of selectedFiles) {
            await portfolioApi.uploadImage(editingItem._id, file);
          }
        }

        // Refresh to get updated item with new images
        const refreshed = await portfolioApi.getPortfolio();
        const item = refreshed.find((i) => i._id === editingItem._id);
        if (item) {
          setPortfolioItems((prev) =>
            prev.map((i) => (i._id === item._id ? item : i))
          );
        }
      } else {
        // Create new item with images
        if (selectedFiles.length === 0) {
          toast.addToast({
        title: 'Validation Error',
        description: 'Please add at least one image',
        variant: 'warning'
      });
          setIsSubmitting(false);
          return;
        }

        const newItem = await portfolioApi.createWithImages(
          {
            title: formData.title,
            description: formData.description,
            category: formData.category,
            tags,
            isVisible: true,
          },
          selectedFiles
        );

        setPortfolioItems((prev) => [newItem, ...prev]);
      }

      // Close modal and reset
      setShowAddModal(false);
      setEditingItem(null);
      setFormData({ title: '', description: '', category: 'Hair', tags: '' });
      setSelectedFiles([]);
      setImagePreviews([]);
    } catch (err: any) {
      console.error('Failed to save portfolio item:', err);
      toast.addToast({
        title: 'Failed to save',
        description: err.response?.data?.message || 'Failed to save portfolio item',
        variant: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingItem(null);
    // FIX: Use first category from fetched list as default
    setFormData({ title: '', description: '', category: categories[0] || 'Hair', tags: '' });
    setSelectedFiles([]);
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImagePreviews([]);
    setUploadError(null);
  };

  // Calculate average rating from testimonials
  const getAverageRating = (): number => {
    const ratings = portfolioItems
      .filter((item) => item.clientTestimonial?.rating)
      .map((item) => item.clientTestimonial!.rating);
    if (ratings.length === 0) return 0;
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
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
                onClick={handleOpenAddModal}
                className="btn-nilin flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Work
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-nilin bg-red-50 border border-red-200 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-800">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-nilin-coral animate-spin" />
              <span className="ml-3 text-nilin-warmGray">Loading portfolio...</span>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && portfolioItems.length === 0 && (
            <div className="glass-nilin rounded-nilin-lg p-12 text-center">
              <Image className="h-16 w-16 text-nilin-warmGray mx-auto mb-4" />
              <h3 className="text-lg font-medium text-nilin-charcoal mb-2">No Portfolio Items Yet</h3>
              <p className="text-nilin-warmGray mb-6">
                Start adding photos of your work to showcase your skills to potential customers.
              </p>
              <button
                onClick={handleOpenAddModal}
                className="btn-nilin inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Your First Work
              </button>
            </div>
          )}

          {/* Portfolio Grid */}
          {!isLoading && portfolioItems.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {portfolioItems.map((item) => (
                  <div
                    key={item._id}
                    className="glass-nilin rounded-nilin-lg overflow-hidden hover-lift group"
                  >
                    {/* Image */}
                    <div className="relative aspect-[4/3] overflow-hidden">
                      {item.images && item.images.length > 0 ? (
                        <img
                          src={item.images[0].url}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-nilin-muted flex items-center justify-center">
                          <Image className="h-12 w-12 text-nilin-warmGray" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                      {/* Category Badge */}
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-nilin-charcoal">
                          {item.category || 'Other'}
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
                          onClick={() => handleDeleteClick(item._id)}
                          className="p-2 bg-white/90 backdrop-blur-sm rounded-full text-red-500 hover:bg-white transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Rating */}
                      {item.clientTestimonial?.rating && (
                        <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full">
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          <span className="text-xs font-medium text-nilin-charcoal">
                            {item.clientTestimonial.rating}
                          </span>
                        </div>
                      )}

                      {/* Image Count */}
                      {item.images && item.images.length > 1 && (
                        <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                          <Image className="h-3 w-3 text-white" />
                          <span className="text-xs font-medium text-white">
                            {item.images.length}
                          </span>
                        </div>
                      )}

                      {/* Individual Image Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageToDelete({ itemId: item._id, imageUrl: item.images[0].url });
                        }}
                        className="absolute bottom-4 left-4 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete image"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-medium text-nilin-charcoal mb-1">{item.title}</h3>
                      <p className="text-sm text-nilin-warmGray line-clamp-2">
                        {item.description || 'No description'}
                      </p>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-nilin-warmGray">
                          {new Date(item.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        {item.clientTestimonial?.clientName && (
                          <p className="text-xs text-nilin-coral">
                            - {item.clientTestimonial.clientName}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stats Summary */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-nilin rounded-nilin-lg p-4 text-center">
                  <div className="text-2xl font-bold text-nilin-charcoal">
                    {portfolioItems.length}
                  </div>
                  <div className="text-sm text-nilin-warmGray">Portfolio Items</div>
                </div>
                <div className="glass-nilin rounded-nilin-lg p-4 text-center">
                  <div className="text-2xl font-bold text-nilin-charcoal">
                    {portfolioItems.reduce((sum, item) => sum + (item.images?.length || 0), 0)}
                  </div>
                  <div className="text-sm text-nilin-warmGray">Total Images</div>
                </div>
                <div className="glass-nilin rounded-nilin-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <div className="text-2xl font-bold text-nilin-charcoal">
                      {getAverageRating().toFixed(1)}
                    </div>
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  </div>
                  <div className="text-sm text-nilin-warmGray">Average Rating</div>
                </div>
              </div>
            </>
          )}

          {/* Tips Section */}
          <div className="mt-8 glass-nilin rounded-nilin-lg p-6">
            <h3 className="text-sm font-medium text-nilin-charcoal mb-3">Tips for a Great Portfolio</h3>
            <ul className="space-y-2 text-sm text-nilin-warmGray">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-nilin-coral mt-1.5 flex-shrink-0" />
                Use high quality images with good lighting to showcase your work
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
          <div className="bg-white rounded-nilin-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-serif text-nilin-charcoal">
                {editingItem ? 'Edit Portfolio Item' : 'Add Portfolio Item'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-nilin-muted rounded-nilin transition-colors"
              >
                <X className="h-5 w-5 text-nilin-warmGray" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Image Upload Area */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Portfolio Images {editingItem ? '(optional - adds to existing)' : '*'}
                </label>

                {/* Image Previews */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-nilin-muted">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-nilin-border rounded-nilin-lg p-6 text-center hover:border-nilin-coral transition-colors cursor-pointer"
                >
                  <Camera className="h-8 w-8 text-nilin-warmGray mx-auto mb-2" />
                  <p className="text-sm text-nilin-warmGray">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-nilin-warmGray mt-1">
                    PNG, JPG, WebP up to 10MB each
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Upload Error */}
                {uploadError && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-nilin text-xs text-red-600">
                    {uploadError}
                  </div>
                )}

                {isUploading && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-nilin-coral">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading images...
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Bridal Makeup - Sarah's Wedding"
                  className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  disabled={categoriesLoading}
                  className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal disabled:opacity-50"
                >
                  {categoriesLoading ? (
                    <option value="">Loading categories...</option>
                  ) : (
                    categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g., bridal, wedding, makeup"
                  className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Describe this work, the techniques used, and customer feedback..."
                  className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || (!editingItem && selectedFiles.length === 0)}
                  className="flex-1 btn-nilin flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      {editingItem ? 'Save Changes' : 'Add to Portfolio'}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />

      {/* Delete Image Confirmation Modal */}
      {imageToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-nilin-lg max-w-md w-full p-6 shadow-xl">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Delete Image</h3>
              <p className="text-nilin-warmGray mb-6">
                Are you sure you want to delete this image? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setImageToDelete(null)}
                  className="flex-1 px-4 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteImage}
                  disabled={isDeletingImage}
                  className="flex-1 px-4 py-3 rounded-nilin bg-red-500 text-white hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
                >
                  {isDeletingImage ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Portfolio Item Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-nilin-lg max-w-md w-full p-6 shadow-xl">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Delete Portfolio Item</h3>
              <p className="text-nilin-warmGray mb-6">
                Are you sure you want to delete this portfolio item? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium"
                >
                  Keep
                </button>
                <button
                  onClick={handleDeleteItem}
                  className="flex-1 px-4 py-3 rounded-nilin bg-red-500 text-white hover:bg-red-600 transition-colors font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderPortfolioPage;
