// NILIN Brand Color Palette
export const NILIN_COLORS = {
  // Primary Pastels
  pastelPink: '#FFE5F0',
  pastelLavender: '#E8E5FF',
  pastelCream: '#F5F3E8',
  pastelBlue: '#E5F3FF',

  // Text Colors
  textPrimary: '#1A202C',
  textSecondary: '#2D3748',
  textTertiary: '#4A5568',
  textLight: '#718096',
  textLighter: '#A0AEC0',

  // UI Colors
  border: '#E2E8F0',
  background: '#FAFBFC',
  backgroundGray: '#F7FAFC',
  backgroundWhite: '#FFFFFF',

  // Status Colors
  success: '#48BB78',
  warning: '#ECC94B',
  error: '#F56565',
  info: '#4299E1',
} as const;

// Gradient Definitions
export const NILIN_GRADIENTS = {
  primary: 'linear-gradient(135deg, #FFE5F0, #E8E5FF)',
  secondary: 'linear-gradient(135deg, #E8E5FF, #E5F3FF)',
  tertiary: 'linear-gradient(135deg, #F5F3E8, #E5F3FF)',
  pinkLavender: 'linear-gradient(135deg, #FFE5F0, #E8E5FF)',
  lavenderBlue: 'linear-gradient(135deg, #E8E5FF, #E5F3FF)',
} as const;

// Helper function to get NILIN color
export const getNilinColor = (colorName: keyof typeof NILIN_COLORS): string => {
  return NILIN_COLORS[colorName];
};

// Helper function to get NILIN gradient
export const getNilinGradient = (gradientName: keyof typeof NILIN_GRADIENTS): string => {
  return NILIN_GRADIENTS[gradientName];
};
