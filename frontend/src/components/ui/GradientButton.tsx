import React from 'react';

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  children, variant = 'primary', size = 'md', className = '', ...props
}) => {
  const sizes = { sm: 'px-4 py-2 text-sm', md: 'px-6 py-3', lg: 'px-8 py-4 text-lg' };
  const variants = {
    primary: 'bg-gradient-to-r from-nilin-coral to-nilin-rose text-white shadow-lg hover:shadow-xl',
    secondary: 'bg-nilin-blush text-nilin-charcoal hover:bg-nilin-peach'
  };
  return (
    <button {...props}
      className={`font-semibold rounded-xl transition-all duration-300 active:scale-95 ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};
