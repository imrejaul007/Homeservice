import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import ServiceCategory from '../models/serviceCategory.model';
import database from '../config/database';

/**
 * NILIN Beauty & Wellness Categories
 * 6 beauty categories promoted from former subcategories to top-level.
 */
const NILIN_CATEGORIES = [
  {
    name: 'Hair',
    slug: 'hair',
    description: 'Professional hair styling, cuts, coloring and treatments at your doorstep',
    icon: 'scissors',
    color: '#FF8A80',
    imageUrl: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=1200',
    sortOrder: 1,
    isFeatured: true,
    metadata: {
      displayConfig: {
        tagline: 'Expert hair stylists at your doorstep',
        heroImage: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=1400',
        iconEmoji: '💇',
        gradient: 'from-nilin-pink/60 to-nilin-pink',
        accentColor: 'bg-nilin-accent'
      }
    },
    subcategories: [
      {
        name: "Women's Haircut",
        slug: 'womens-haircut',
        description: 'Professional women\'s haircuts and styling',
        icon: 'scissors',
        color: '#FF8A80',
        sortOrder: 1,
        isActive: true,
        metadata: { displayName: "Women's Haircut", averagePrice: 200, averageDuration: 60 }
      },
      {
        name: "Men's Haircut",
        slug: 'mens-haircut',
        description: 'Professional men\'s haircuts and grooming',
        icon: 'scissors',
        color: '#FF8A80',
        sortOrder: 2,
        isActive: true,
        metadata: { displayName: "Men's Haircut", averagePrice: 100, averageDuration: 30 }
      },
      {
        name: 'Coloring',
        slug: 'coloring',
        description: 'Full color, highlights, balayage and more',
        icon: 'palette',
        color: '#F48FB1',
        sortOrder: 3,
        isActive: true,
        metadata: { displayName: 'Hair Coloring', averagePrice: 500, averageDuration: 120 }
      },
      {
        name: 'Treatments',
        slug: 'treatments',
        description: 'Keratin, deep conditioning, and hair repair',
        icon: 'sparkles',
        color: '#CE93D8',
        sortOrder: 4,
        isActive: true,
        metadata: { displayName: 'Hair Treatments', averagePrice: 400, averageDuration: 90 }
      },
      {
        name: 'Blowout',
        slug: 'blowout',
        description: 'Professional blowout and blow-dry styling',
        icon: 'wind',
        color: '#B39DDB',
        sortOrder: 5,
        isActive: true,
        metadata: { displayName: 'Blowout', averagePrice: 150, averageDuration: 45 }
      },
      {
        name: 'Bridal Hair',
        slug: 'bridal-hair',
        description: 'Wedding and event hair styling packages',
        icon: 'crown',
        color: '#90CAF9',
        sortOrder: 6,
        isActive: true,
        metadata: { displayName: 'Bridal Hair', averagePrice: 800, averageDuration: 120 }
      }
    ],
    seo: {
      metaTitle: 'Hair Services at Home - NILIN Dubai',
      metaDescription: 'Book professional hair services at home in Dubai - cuts, coloring, treatments, blowouts and bridal hair.',
      keywords: ['hair styling', 'haircut at home', 'hair coloring', 'bridal hair', 'dubai']
    }
  },

  {
    name: 'Makeup',
    slug: 'makeup',
    description: 'Professional makeup artistry for every occasion',
    icon: 'palette',
    color: '#F48FB1',
    imageUrl: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=1200',
    sortOrder: 2,
    isFeatured: true,
    metadata: {
      displayConfig: {
        tagline: 'Certified makeup artists at your location',
        heroImage: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=1400',
        iconEmoji: '💄',
        gradient: 'from-rose-100/60 to-rose-200',
        accentColor: 'bg-rose-500'
      }
    },
    subcategories: [
      {
        name: 'Bridal',
        slug: 'bridal-makeup',
        description: 'Complete bridal makeup with trial',
        icon: 'crown',
        color: '#F48FB1',
        sortOrder: 1,
        isActive: true,
        metadata: { displayName: 'Bridal Makeup', averagePrice: 1500, averageDuration: 120 }
      },
      {
        name: 'Party & Event',
        slug: 'party-event-makeup',
        description: 'Glam looks for parties and special events',
        icon: 'sparkles',
        color: '#F48FB1',
        sortOrder: 2,
        isActive: true,
        metadata: { displayName: 'Party & Event Makeup', averagePrice: 500, averageDuration: 60 }
      },
      {
        name: 'Everyday',
        slug: 'everyday-makeup',
        description: 'Natural, everyday makeup application',
        icon: 'palette',
        color: '#CE93D8',
        sortOrder: 3,
        isActive: true,
        metadata: { displayName: 'Everyday Makeup', averagePrice: 300, averageDuration: 45 }
      },
      {
        name: 'Lessons',
        slug: 'makeup-lessons',
        description: 'Learn makeup techniques from professionals',
        icon: 'book',
        color: '#B39DDB',
        sortOrder: 4,
        isActive: true,
        metadata: { displayName: 'Makeup Lessons', averagePrice: 600, averageDuration: 90 }
      },
      {
        name: 'Editorial',
        slug: 'editorial-makeup',
        description: 'High-fashion and editorial makeup for shoots',
        icon: 'camera',
        color: '#90CAF9',
        sortOrder: 5,
        isActive: true,
        metadata: { displayName: 'Editorial Makeup', averagePrice: 800, averageDuration: 90 }
      }
    ],
    seo: {
      metaTitle: 'Makeup Services at Home - NILIN Dubai',
      metaDescription: 'Book professional makeup artists in Dubai - bridal, party, everyday, lessons and editorial makeup.',
      keywords: ['makeup artist', 'bridal makeup', 'party makeup', 'makeup at home', 'dubai']
    }
  },

  {
    name: 'Nails',
    slug: 'nails',
    description: 'Professional nail care, extensions and art at home',
    icon: 'hand',
    color: '#CE93D8',
    imageUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1200',
    sortOrder: 3,
    isFeatured: true,
    metadata: {
      displayConfig: {
        tagline: 'Skilled nail technicians at your doorstep',
        heroImage: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1400',
        iconEmoji: '💅',
        gradient: 'from-nilin-lavender/60 to-nilin-lavender',
        accentColor: 'bg-purple-500'
      }
    },
    subcategories: [
      {
        name: 'Manicure',
        slug: 'manicure',
        description: 'Classic and luxury manicure services',
        icon: 'hand',
        color: '#CE93D8',
        sortOrder: 1,
        isActive: true,
        metadata: { displayName: 'Manicure', averagePrice: 150, averageDuration: 45 }
      },
      {
        name: 'Pedicure',
        slug: 'pedicure',
        description: 'Relaxing pedicure treatments',
        icon: 'hand',
        color: '#CE93D8',
        sortOrder: 2,
        isActive: true,
        metadata: { displayName: 'Pedicure', averagePrice: 200, averageDuration: 60 }
      },
      {
        name: 'Gel',
        slug: 'gel-nails',
        description: 'Long-lasting gel nail application',
        icon: 'sparkles',
        color: '#B39DDB',
        sortOrder: 3,
        isActive: true,
        metadata: { displayName: 'Gel Nails', averagePrice: 250, averageDuration: 60 }
      },
      {
        name: 'Acrylic',
        slug: 'acrylic-nails',
        description: 'Acrylic nail extensions and fills',
        icon: 'sparkles',
        color: '#B39DDB',
        sortOrder: 4,
        isActive: true,
        metadata: { displayName: 'Acrylic Nails', averagePrice: 350, averageDuration: 90 }
      },
      {
        name: 'Nail Art',
        slug: 'nail-art',
        description: 'Custom nail art designs and embellishments',
        icon: 'palette',
        color: '#F48FB1',
        sortOrder: 5,
        isActive: true,
        metadata: { displayName: 'Nail Art', averagePrice: 300, averageDuration: 60 }
      }
    ],
    seo: {
      metaTitle: 'Nail Services at Home - NILIN Dubai',
      metaDescription: 'Book professional nail services at home in Dubai - manicure, pedicure, gel, acrylic and nail art.',
      keywords: ['nail care', 'manicure at home', 'pedicure', 'gel nails', 'nail art', 'dubai']
    }
  },

  {
    name: 'Skin & Aesthetics',
    slug: 'skin-aesthetics',
    description: 'Luxury facial treatments and skin care at home',
    icon: 'sparkles',
    color: '#B39DDB',
    imageUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200',
    sortOrder: 4,
    isFeatured: true,
    metadata: {
      displayConfig: {
        tagline: 'Expert estheticians at your location',
        heroImage: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1400',
        iconEmoji: '✨',
        gradient: 'from-purple-100/60 to-purple-200',
        accentColor: 'bg-purple-500'
      }
    },
    subcategories: [
      {
        name: 'Facial',
        slug: 'facial',
        description: 'Classic, hydrating and deep-cleansing facials',
        icon: 'sparkles',
        color: '#B39DDB',
        sortOrder: 1,
        isActive: true,
        metadata: { displayName: 'Facial', averagePrice: 400, averageDuration: 60 }
      },
      {
        name: 'Chemical Peel',
        slug: 'chemical-peel',
        description: 'Professional chemical peel treatments',
        icon: 'sparkles',
        color: '#B39DDB',
        sortOrder: 2,
        isActive: true,
        metadata: { displayName: 'Chemical Peel', averagePrice: 600, averageDuration: 45 }
      },
      {
        name: 'Anti-Aging',
        slug: 'anti-aging',
        description: 'Anti-aging and rejuvenation treatments',
        icon: 'sparkles',
        color: '#CE93D8',
        sortOrder: 3,
        isActive: true,
        metadata: { displayName: 'Anti-Aging', averagePrice: 800, averageDuration: 75 }
      },
      {
        name: 'Acne',
        slug: 'acne-treatment',
        description: 'Acne treatment and scar reduction',
        icon: 'sparkles',
        color: '#90CAF9',
        sortOrder: 4,
        isActive: true,
        metadata: { displayName: 'Acne Treatment', averagePrice: 500, averageDuration: 60 }
      },
      {
        name: 'Consultation',
        slug: 'skin-consultation',
        description: 'Professional skin assessment and advice',
        icon: 'clipboard',
        color: '#A5D6A7',
        sortOrder: 5,
        isActive: true,
        metadata: { displayName: 'Skin Consultation', averagePrice: 300, averageDuration: 30 }
      }
    ],
    seo: {
      metaTitle: 'Skin & Aesthetics at Home - NILIN Dubai',
      metaDescription: 'Book professional skin treatments in Dubai - facials, chemical peels, anti-aging, acne treatment.',
      keywords: ['facial at home', 'skin care', 'chemical peel', 'anti-aging', 'aesthetics', 'dubai']
    }
  },

  {
    name: 'Massage & Body',
    slug: 'massage-body',
    description: 'Professional massage therapy and body treatments at home',
    icon: 'massage',
    color: '#90CAF9',
    imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200',
    sortOrder: 5,
    isFeatured: true,
    metadata: {
      displayConfig: {
        tagline: 'Licensed massage therapists at your location',
        heroImage: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1400',
        iconEmoji: '💆',
        gradient: 'from-nilin-blue/60 to-nilin-blue',
        accentColor: 'bg-blue-500'
      }
    },
    subcategories: [
      {
        name: 'Swedish',
        slug: 'swedish-massage',
        description: 'Classic relaxation Swedish massage',
        icon: 'massage',
        color: '#90CAF9',
        sortOrder: 1,
        isActive: true,
        metadata: { displayName: 'Swedish Massage', averagePrice: 400, averageDuration: 60 }
      },
      {
        name: 'Deep Tissue',
        slug: 'deep-tissue',
        description: 'Targeted deep tissue massage for pain relief',
        icon: 'massage',
        color: '#90CAF9',
        sortOrder: 2,
        isActive: true,
        metadata: { displayName: 'Deep Tissue Massage', averagePrice: 500, averageDuration: 60 }
      },
      {
        name: 'Hot Stone',
        slug: 'hot-stone',
        description: 'Heated stone therapy for deep relaxation',
        icon: 'massage',
        color: '#64B5F6',
        sortOrder: 3,
        isActive: true,
        metadata: { displayName: 'Hot Stone Massage', averagePrice: 600, averageDuration: 75 }
      },
      {
        name: 'Aromatherapy',
        slug: 'aromatherapy',
        description: 'Essential oil aromatherapy massage',
        icon: 'massage',
        color: '#A5D6A7',
        sortOrder: 4,
        isActive: true,
        metadata: { displayName: 'Aromatherapy Massage', averagePrice: 450, averageDuration: 60 }
      },
      {
        name: 'Body Scrub',
        slug: 'body-scrub',
        description: 'Exfoliating body scrub treatments',
        icon: 'sparkles',
        color: '#CE93D8',
        sortOrder: 5,
        isActive: true,
        metadata: { displayName: 'Body Scrub', averagePrice: 350, averageDuration: 45 }
      }
    ],
    seo: {
      metaTitle: 'Massage & Body Treatments at Home - NILIN Dubai',
      metaDescription: 'Book professional massage therapists in Dubai - Swedish, deep tissue, hot stone, aromatherapy.',
      keywords: ['massage at home', 'deep tissue', 'swedish massage', 'hot stone', 'body treatment', 'dubai']
    }
  },

  {
    name: 'Personal Care',
    slug: 'personal-care',
    description: 'Threading, waxing, lash and brow services at home',
    icon: 'eye',
    color: '#A5D6A7',
    imageUrl: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=1200',
    sortOrder: 6,
    isFeatured: true,
    metadata: {
      displayConfig: {
        tagline: 'Grooming essentials at your doorstep',
        heroImage: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=1400',
        iconEmoji: '👁️',
        gradient: 'from-nilin-cream/60 to-nilin-cream',
        accentColor: 'bg-emerald-500'
      }
    },
    subcategories: [
      {
        name: 'Threading',
        slug: 'threading',
        description: 'Eyebrow and facial threading',
        icon: 'eye',
        color: '#A5D6A7',
        sortOrder: 1,
        isActive: true,
        metadata: { displayName: 'Threading', averagePrice: 50, averageDuration: 15 }
      },
      {
        name: 'Waxing',
        slug: 'waxing',
        description: 'Full body and facial waxing services',
        icon: 'sparkles',
        color: '#A5D6A7',
        sortOrder: 2,
        isActive: true,
        metadata: { displayName: 'Waxing', averagePrice: 200, averageDuration: 45 }
      },
      {
        name: 'Lash Extensions',
        slug: 'lash-extensions',
        description: 'Classic, volume and hybrid lash extensions',
        icon: 'eye',
        color: '#CE93D8',
        sortOrder: 3,
        isActive: true,
        metadata: { displayName: 'Lash Extensions', averagePrice: 500, averageDuration: 90 }
      },
      {
        name: 'Brow Shaping',
        slug: 'brow-shaping',
        description: 'Professional brow shaping and tinting',
        icon: 'eye',
        color: '#B39DDB',
        sortOrder: 4,
        isActive: true,
        metadata: { displayName: 'Brow Shaping', averagePrice: 100, averageDuration: 30 }
      },
      {
        name: 'Henna',
        slug: 'henna',
        description: 'Traditional and modern henna art',
        icon: 'palette',
        color: '#FFB74D',
        sortOrder: 5,
        isActive: true,
        metadata: { displayName: 'Henna', averagePrice: 300, averageDuration: 60 }
      }
    ],
    seo: {
      metaTitle: 'Personal Care Services at Home - NILIN Dubai',
      metaDescription: 'Book personal care services in Dubai - threading, waxing, lash extensions, brow shaping and henna.',
      keywords: ['threading', 'waxing at home', 'lash extensions', 'brow shaping', 'henna', 'dubai']
    }
  }
];

export const seedCategories = async (): Promise<void> => {
  try {
    console.log('Starting NILIN Beauty & Wellness categories seeding...');

    // Clear existing categories
    await ServiceCategory.deleteMany({});
    console.log('Cleared existing categories');

    // Insert new categories with full metadata
    await ServiceCategory.insertMany(NILIN_CATEGORIES);
    console.log('NILIN beauty categories seeded successfully');

    // Log statistics
    const totalSubcategories = NILIN_CATEGORIES.reduce((acc, cat) => acc + cat.subcategories.length, 0);
    console.log(`Seeding Statistics:`);
    console.log(`   Master Categories: ${NILIN_CATEGORIES.length}`);
    console.log(`   Total Subcategories: ${totalSubcategories}`);
    console.log(`   Featured Categories: ${NILIN_CATEGORIES.filter(cat => cat.isFeatured).length}`);

    // Show category breakdown
    console.log(`NILIN Category Breakdown:`);
    NILIN_CATEGORIES.forEach((cat, index) => {
      console.log(`   ${index + 1}. ${cat.name} (${cat.subcategories.length} subcategories)`);
    });

    return Promise.resolve();
  } catch (error) {
    console.error('Error seeding categories:', error);
    throw error;
  }
};

// Advanced seeding with user audit
export const seedCategoriesWithAudit = async (adminUserId?: string): Promise<void> => {
  try {
    console.log('Starting NILIN beauty categories seeding with audit...');

    // Add audit information if admin user provided
    const categoriesWithAudit = NILIN_CATEGORIES.map(cat => ({
      ...cat,
      createdBy: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : undefined,
      updatedBy: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : undefined
    }));

    // Clear existing categories
    await ServiceCategory.deleteMany({});
    console.log('Cleared existing categories');

    // Insert new categories
    await ServiceCategory.insertMany(categoriesWithAudit);
    console.log('NILIN beauty categories seeded successfully with audit trail');

  } catch (error) {
    console.error('Error seeding categories with audit:', error);
    throw error;
  }
};

// Export the categories for use in migration scripts
export const NILIN_MASTER_CATEGORIES = NILIN_CATEGORIES;

// Run seeder if called directly
if (require.main === module) {
  (async () => {
    try {
      await database.connect();
      await seedCategories();
      console.log('NILIN beauty category seeding completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('Seeding failed:', error);
      process.exit(1);
    }
  })();
}
