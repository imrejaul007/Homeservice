import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  X,
  Save,
  Loader2,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Pin,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import AdminExperiencePanel from '../../components/dashboard/AdminExperiencePanel';
import { curatedTrendApi } from '../../services/curatedTrendApi';
import type { CuratedTrend } from '../../types/trendingFeed';

type AdminTab = 'curated' | 'experiences';

const emptyForm = {
  title: '',
  subtitle: '',
  imageUrl: '',
  videoUrl: '',
  linkType: 'category' as CuratedTrend['linkType'],
  linkTarget: '',
  categoryLabel: '',
  metricOverride: '',
  sortOrder: 0,
  isActive: true,
  isPinned: false,
};

const CuratedTrendingManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('curated');
  const [items, setItems] = useState<CuratedTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CuratedTrend | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await curatedTrendApi.list({ limit: 100 });
      setItems(response.data.items);
    } catch {
      toast.error('Failed to load curated trends');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'curated') {
      loadItems();
    }
  }, [activeTab, loadItems]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sortOrder: items.length });
    setShowModal(true);
  };

  const openEdit = (item: CuratedTrend) => {
    setEditing(item);
    setForm({
      title: item.title,
      subtitle: item.subtitle,
      imageUrl: item.imageUrl,
      videoUrl: item.videoUrl || '',
      linkType: item.linkType,
      linkTarget: item.linkTarget,
      categoryLabel: item.categoryLabel,
      metricOverride: item.metricOverride || '',
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      isPinned: item.isPinned,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...form,
        videoUrl: form.videoUrl || undefined,
        metricOverride: form.metricOverride || undefined,
      };

      if (editing) {
        await curatedTrendApi.update(editing._id, payload);
        toast.success('Curated trend updated');
      } else {
        await curatedTrendApi.create(payload);
        toast.success('Curated trend created');
      }

      setShowModal(false);
      await loadItems();
    } catch {
      toast.error('Failed to save curated trend');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this curated trend?')) return;
    try {
      await curatedTrendApi.remove(id);
      toast.success('Deleted');
      await loadItems();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const reordered = [...items];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    try {
      await curatedTrendApi.reorder(
        reordered.map((item, sortOrder) => ({ id: item._id, sortOrder }))
      );
      setItems(reordered.map((item, sortOrder) => ({ ...item, sortOrder })));
      toast.success('Order updated');
    } catch {
      toast.error('Failed to reorder');
    }
  };

  return (
    <AdminPageShell
      title="Homepage Trending"
      description="Curate the Trending Now carousel and manage featured experiences"
    >
      <div className="flex gap-2 mb-6">
        {(['curated', 'experiences'] as AdminTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              activeTab === tab ? 'bg-nilin-coral text-white' : 'bg-white border border-nilin-border/50'
            }`}
          >
            {tab === 'curated' ? 'Curated Cards' : 'Experiences'}
          </button>
        ))}
      </div>

      {activeTab === 'experiences' ? (
        <AdminExperiencePanel embedded />
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-nilin-warmGray">
              Pinned and ordered cards appear first in the homepage Trending Now section.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => loadItems()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-nilin-border/50 bg-white text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-nilin-coral text-white text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Card
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-nilin-coral" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-nilin-border/30">
              <ImageIcon className="w-12 h-12 text-nilin-warmGray mx-auto mb-3" />
              <p className="text-nilin-charcoal font-medium">No curated cards yet</p>
              <p className="text-sm text-nilin-warmGray mb-4">Add cards or run the seed script for launch content.</p>
              <button type="button" onClick={openCreate} className="px-4 py-2 bg-nilin-coral text-white rounded-lg text-sm">
                Create first card
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-nilin-border/30 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-nilin-blush/20 text-left">
                  <tr>
                    <th className="p-4">Preview</th>
                    <th className="p-4">Title</th>
                    <th className="p-4">Link</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Order</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item._id} className="border-t border-nilin-border/20">
                      <td className="p-4">
                        <img src={item.imageUrl} alt={item.title} className="w-14 h-18 object-cover rounded-lg" />
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-nilin-charcoal flex items-center gap-2">
                          {item.isPinned && <Pin className="w-3.5 h-3.5 text-nilin-coral" />}
                          {item.title}
                        </div>
                        <div className="text-nilin-warmGray text-xs">{item.categoryLabel}</div>
                      </td>
                      <td className="p-4 text-xs text-nilin-warmGray">
                        {item.linkType}: {item.linkTarget}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => moveItem(index, 'up')} className="p-1 rounded hover:bg-nilin-blush/30">
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => moveItem(index, 'down')} className="p-1 rounded hover:bg-nilin-blush/30">
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <span className="text-xs text-nilin-warmGray ml-1">#{item.sortOrder}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => openEdit(item)} className="p-2 rounded-lg hover:bg-nilin-blush/30">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleDelete(item._id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-nilin-border/30">
              <h2 className="text-lg font-semibold text-nilin-charcoal">
                {editing ? 'Edit Curated Card' : 'New Curated Card'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-nilin-border/50 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subtitle</label>
                <input
                  required
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  className="w-full px-3 py-2 border border-nilin-border/50 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Image URL</label>
                <input
                  required
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-nilin-border/50 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Link Type</label>
                  <select
                    value={form.linkType}
                    onChange={(e) => setForm({ ...form, linkType: e.target.value as CuratedTrend['linkType'] })}
                    className="w-full px-3 py-2 border border-nilin-border/50 rounded-lg"
                  >
                    <option value="category">Category</option>
                    <option value="service">Service</option>
                    <option value="experience">Experience</option>
                    <option value="search">Search</option>
                    <option value="external">External URL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Link Target</label>
                  <input
                    required
                    value={form.linkTarget}
                    onChange={(e) => setForm({ ...form, linkTarget: e.target.value })}
                    placeholder="slug, id, or URL"
                    className="w-full px-3 py-2 border border-nilin-border/50 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category Label</label>
                <input
                  required
                  value={form.categoryLabel}
                  onChange={(e) => setForm({ ...form, categoryLabel: e.target.value })}
                  className="w-full px-3 py-2 border border-nilin-border/50 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Metric Override (optional)</label>
                <input
                  value={form.metricOverride}
                  onChange={(e) => setForm({ ...form, metricOverride: e.target.value })}
                  placeholder="e.g. 15K views"
                  className="w-full px-3 py-2 border border-nilin-border/50 rounded-lg"
                />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isPinned}
                    onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
                  />
                  Pinned
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-nilin-coral text-white disabled:opacity-60"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
};

export default CuratedTrendingManagement;
