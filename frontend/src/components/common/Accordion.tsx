import React, { createContext, useContext, useState, useCallback } from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AccordionContextType {
  expandedItems: Set<string>;
  toggleItem: (value: string) => void;
  isItemExpanded: (value: string) => boolean;
}

const AccordionContext = createContext<AccordionContextType | null>(null);

const useAccordionContext = () => {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion components must be used within Accordion');
  }
  return context;
};

interface AccordionProps {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  collapsible?: boolean;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  children,
  defaultValue,
  value,
  onValueChange,
  collapsible = true,
  className,
}) => {
  const [internalValue, setInternalValue] = useState<string | undefined>(defaultValue);
  const currentValue = value !== undefined ? value : internalValue;
  const expandedItems = new Set(currentValue ? [currentValue] : []);

  const toggleItem = useCallback((itemValue: string) => {
    const isExpanded = expandedItems.has(itemValue);
    let newValue: string | undefined;

    if (isExpanded && !collapsible) {
      newValue = currentValue;
    } else {
      newValue = itemValue;
    }

    setInternalValue(newValue);
    onValueChange?.(newValue as string);
  }, [expandedItems, currentValue, collapsible, onValueChange]);

  const isItemExpanded = useCallback((itemValue: string) => {
    return expandedItems.has(itemValue);
  }, [expandedItems]);

  return (
    <AccordionContext.Provider value={{ expandedItems, toggleItem, isItemExpanded }}>
      <AccordionPrimitive.Root
        type="single"
        collapsible={collapsible}
        defaultValue={defaultValue}
        value={currentValue}
        onValueChange={(val) => {
          setInternalValue(val);
          onValueChange?.(val);
        }}
        className={cn('w-full', className)}
      >
        {children}
      </AccordionPrimitive.Root>
    </AccordionContext.Provider>
  );
};

export const AccordionItem: React.FC<{ children: React.ReactNode; value: string; className?: string }> = ({
  children,
  value,
  className,
}) => {
  return (
    <AccordionPrimitive.Item value={value} className={cn('overflow-hidden', className)}>
      {children}
    </AccordionPrimitive.Item>
  );
};

export const AccordionTrigger: React.FC<{
  children: React.ReactNode;
  className?: string;
  showArrow?: boolean;
}> = ({
  children,
  className,
  showArrow = true,
}) => {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'flex-1 flex items-center gap-2 py-4 px-5 text-left transition-colors',
          'hover:bg-nilin-blush/50',
          'focus:outline-none focus:ring-2 focus:ring-nilin-coral/30',
          'text-nilin-charcoal font-medium',
          className
        )}
      >
        {children}
        {showArrow && (
          <ChevronDown className="w-5 h-5 text-nilin-warmGray ml-auto transition-transform" />
        )}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
};

export const AccordionContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  return (
    <AccordionPrimitive.Content
      className={cn(
        'overflow-hidden transition-all duration-300',
        'data-[state=closed]:animate-accordion-up',
        'data-[state=open]:animate-accordion-down',
        className
      )}
    >
      <div className="px-5 pb-4 text-nilin-warmGray">
        {children}
      </div>
    </AccordionPrimitive.Content>
  );
};

// Helper component for custom header actions
interface AccordionHeaderProps {
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const AccordionHeader: React.FC<AccordionHeaderProps> = ({
  children,
  actions,
  className,
}) => {
  return (
    <div className={cn('flex items-center justify-between py-4 px-5', className)}>
      <span className="font-medium text-gray-900 text-sm md:text-base">{children}</span>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
};

// Pre-styled FAQ Accordion
interface FAQAccordionProps {
  faqs: Array<{
    question: string;
    answer: string | React.ReactNode;
  }>;
  defaultOpen?: number;
  className?: string;
  allowMultipleOpen?: boolean;
}

export const FAQAccordion: React.FC<FAQAccordionProps> = ({
  faqs,
  defaultOpen = 0,
  className,
}) => {
  return (
    <Accordion
      defaultValue={`faq-${defaultOpen}`}
      className={className}
    >
      {faqs.map((faq, index) => (
        <AccordionItem key={index} value={`faq-${index}`}>
          <AccordionTrigger>
            {faq.question}
          </AccordionTrigger>
          <AccordionContent>
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

// Collapsible Card with Accordion behavior
interface CollapsibleCardProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  children,
  defaultOpen = false,
  icon,
  actions,
  className,
  contentClassName,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 overflow-hidden', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-gray-400">{icon}</span>}
          <span className="font-medium text-gray-900 text-sm md:text-base">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <ChevronDown
            className={cn(
              'w-5 h-5 text-gray-400 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className={cn('px-4 md:px-5 pb-4 md:pb-5', contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
};

// Compact Accordion for sidebar/navigation
interface CompactAccordionProps {
  items: Array<{
    id: string;
    title: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
    badge?: string | number;
  }>;
  defaultOpen?: string;
  className?: string;
}

export const CompactAccordion: React.FC<CompactAccordionProps> = ({
  items,
  defaultOpen,
  className,
}) => {
  const [openItem, setOpenItem] = useState<string | null>(defaultOpen || null);

  return (
    <div className={cn('space-y-1', className)}>
      {items.map((item) => (
        <div key={item.id} className="rounded-lg overflow-hidden">
          <button
            onClick={() => setOpenItem(openItem === item.id ? null : item.id)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium transition-colors rounded-lg',
              openItem === item.id
                ? 'bg-nilin-primary text-white'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <div className="flex items-center gap-2">
              {item.icon && <span className="w-4 h-4">{item.icon}</span>}
              <span>{item.title}</span>
            </div>
            <div className="flex items-center gap-2">
              {item.badge && (
                <span className={cn(
                  'px-1.5 py-0.5 text-xs rounded-full',
                  openItem === item.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                )}>
                  {item.badge}
                </span>
              )}
              <ChevronDown
                className={cn(
                  'w-4 h-4 transition-transform duration-200',
                  openItem === item.id && 'rotate-180'
                )}
              />
            </div>
          </button>
          {openItem === item.id && (
            <div className="mt-1 px-3 py-2 bg-gray-50 rounded-lg">
              {item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default Accordion;
