import React, { useState } from 'react';
import { GitCompare, X, Trash2 } from 'lucide-react';
import { useComparisonStore } from '../../stores/comparisonStore';
import ServiceComparisonModal from './ServiceComparisonModal';

const ComparisonBar: React.FC = () => {
  const items = useComparisonStore((s) => s.items);
  const removeService = useComparisonStore((s) => s.removeService);
  const clearAll = useComparisonStore((s) => s.clearAll);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <h2 className="sr-only">Service comparison bar</h2>
      {!isModalOpen && (
        <div
          role="region"
          aria-label="Service comparison bar"
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] animate-slide-up transition-all duration-300 ${items.length < 2 ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100 translate-y-0'}`}
        >
          <div className="bg-nilin-charcoal/95 backdrop-blur-sm text-white rounded-xl shadow-nilin-warm border border-white/10 px-4 py-3 flex items-center gap-3 max-w-[calc(100vw-2rem)]">
            <div className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-nilin-coral drop-shadow-sm" aria-hidden="true" />
              <span className="font-bold text-base whitespace-nowrap" aria-live="polite">
                {items.length} to compare <span className="text-white/50 text-xs">(up to 4)</span>
              </span>
            </div>

            <div
              className="hidden sm:flex items-center gap-1.5 max-w-xs overflow-x-auto scrollbar-hide"
              aria-label={`Selected services: ${items.length} of 4`}
              role="list"
              tabIndex={0}
            >
              {items.map((item) => {
                const title = item.service.title || item.service.name;
                const shortTitle = title.length > 18 ? `${title.substring(0, 18)}…` : title;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-1 bg-white/10 rounded-full pl-2.5 pr-1 py-0.5 text-xs transition-all duration-200 hover:bg-white/20"
                  >
                    <span className="whitespace-nowrap" title={title} aria-label={title}>{shortTitle}</span>
                    <button
                      onClick={() => removeService(item.id)}
                      aria-label={`Remove ${title} from comparison`}
                      className="p-2 flex items-center justify-center rounded-full active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-nilin-charcoal"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={clearAll}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-nilin-charcoal"
                aria-label="Clear all"
                title="Clear all"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                aria-label={`Compare ${items.length} services`}
                className={`px-4 py-1.5 bg-nilin-coral hover:bg-nilin-rose text-white rounded-lg text-sm font-semibold active:scale-95 transition-all flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-nilin-charcoal ${items.length === 4 ? 'shadow-[0_0_20px_rgba(239,68,68,0.5)]' : ''}`}
              >
                Compare Now
              </button>
            </div>
          </div>
        </div>
      )}

      <ServiceComparisonModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
};

export default ComparisonBar;
