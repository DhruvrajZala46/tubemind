// 🟠 PHASE 3.4: MOBILE RESPONSIVENESS
// Comprehensive mobile-first responsive design components

import React from 'react';
import { cn } from '../../lib/utils';
import { Menu, X, ChevronDown } from 'lucide-react';

// 🎯 Responsive Container Component
interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  maxWidth = 'lg',
  padding = 'md',
  className
}) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    '2xl': 'max-w-7xl',
    full: 'max-w-full'
  };

  const paddingClasses = {
    none: '',
    sm: 'px-2 sm:px-4',
    md: 'px-4 sm:px-6 lg:px-8',
    lg: 'px-6 sm:px-8 lg:px-12'
  };

  return (
    <div className={cn(
      'mx-auto w-full',
      maxWidthClasses[maxWidth],
      paddingClasses[padding],
      className
    )}>
      {children}
    </div>
  );
};

// 🎯 Mobile Navigation Component
interface MobileNavProps {
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  children,
  isOpen,
  onToggle,
  className
}) => {
  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={onToggle}
        className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Toggle mobile menu"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={onToggle}
          />
          
          {/* Menu Panel */}
          <div className={cn(
            "fixed inset-y-0 right-0 w-full max-w-sm bg-white dark:bg-gray-900 shadow-xl transform transition-transform duration-300 ease-in-out",
            className
          )}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Menu</h2>
              <button
                onClick={onToggle}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-4 py-6 space-y-4">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// 🎯 Responsive Grid Component
interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  cols = { default: 1, md: 2, lg: 3 },
  gap = 'md',
  className
}) => {
  const getGridColsClass = () => {
    const classes = [];
    
    if (cols.default) classes.push(`grid-cols-${cols.default}`);
    if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`);
    if (cols.md) classes.push(`md:grid-cols-${cols.md}`);
    if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`);
    if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`);
    
    return classes.join(' ');
  };

  const gapClasses = {
    none: 'gap-0',
    sm: 'gap-2 sm:gap-3',
    md: 'gap-4 sm:gap-6',
    lg: 'gap-6 sm:gap-8',
    xl: 'gap-8 sm:gap-10'
  };

  return (
    <div className={cn(
      'grid',
      getGridColsClass(),
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  );
};

// 🎯 Mobile-Optimized Card Component
interface MobileCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

export const MobileCard: React.FC<MobileCardProps> = ({
  children,
  title,
  subtitle,
  actions,
  collapsible = false,
  defaultExpanded = true,
  className
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  return (
    <div className={cn(
      "bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm",
      className
    )}>
      {/* Header */}
      {(title || subtitle || actions) && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              {title && (
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {title}
                  </h3>
                  {collapsible && (
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <ChevronDown 
                        size={16} 
                        className={cn(
                          "transform transition-transform",
                          isExpanded ? "rotate-180" : ""
                        )}
                      />
                    </button>
                  )}
                </div>
              )}
              {subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && (
              <div className="ml-3 flex-shrink-0">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {(!collapsible || isExpanded) && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
};

// 🎯 Responsive Text Component
interface ResponsiveTextProps {
  children: React.ReactNode;
  size?: {
    default?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
    sm?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
    md?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
    lg?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  };
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'error';
  className?: string;
  as?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export const ResponsiveText: React.FC<ResponsiveTextProps> = ({
  children,
  size = { default: 'base' },
  weight = 'normal',
  color = 'default',
  className,
  as: Component = 'p'
}) => {
  const getSizeClasses = () => {
    const classes = [];
    
    if (size.default) classes.push(`text-${size.default}`);
    if (size.sm) classes.push(`sm:text-${size.sm}`);
    if (size.md) classes.push(`md:text-${size.md}`);
    if (size.lg) classes.push(`lg:text-${size.lg}`);
    
    return classes.join(' ');
  };

  const weightClasses = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold'
  };

  const colorClasses = {
    default: 'text-gray-900 dark:text-white',
    muted: 'text-gray-600 dark:text-gray-400',
    primary: 'text-blue-600 dark:text-blue-400',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400'
  };

  return (
    <Component className={cn(
      getSizeClasses(),
      weightClasses[weight],
      colorClasses[color],
      className
    )}>
      {children}
    </Component>
  );
};

// 🎯 Mobile-Optimized Form Component
interface MobileFormProps {
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  className?: string;
}

export const MobileForm: React.FC<MobileFormProps> = ({
  children,
  onSubmit,
  className
}) => {
  return (
    <form 
      onSubmit={onSubmit}
      className={cn(
        "space-y-4 w-full max-w-md mx-auto px-4 sm:px-0",
        className
      )}
    >
      {children}
    </form>
  );
};

// 🎯 Mobile-Optimized Input Component
interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const MobileInput: React.FC<MobileInputProps> = ({
  label,
  error,
  helpText,
  icon,
  fullWidth = true,
  className,
  ...props
}) => {
  return (
    <div className={cn(fullWidth && "w-full")}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="text-gray-400">
              {icon}
            </div>
          </div>
        )}
        
        <input
          className={cn(
            "w-full px-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            icon && "pl-10",
            error && "border-red-500 focus:ring-red-500 focus:border-red-500",
            className
          )}
          {...props}
        />
      </div>
      
      {helpText && !error && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {helpText}
        </p>
      )}
      
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

// 🎯 Mobile-Optimized Button Component
interface MobileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const MobileButton: React.FC<MobileButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  iconPosition = 'left',
  className,
  disabled,
  ...props
}) => {
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline: 'border border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 focus:ring-gray-500',
    ghost: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-500'
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl'
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        (disabled || loading) && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <span className="mr-2">{icon}</span>
          )}
          {children}
          {icon && iconPosition === 'right' && (
            <span className="ml-2">{icon}</span>
          )}
        </>
      )}
    </button>
  );
};

// 🎯 Responsive Utility Hooks
export const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = React.useState<'sm' | 'md' | 'lg' | 'xl' | '2xl'>('sm');

  React.useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth;
      if (width >= 1536) setBreakpoint('2xl');
      else if (width >= 1280) setBreakpoint('xl');
      else if (width >= 1024) setBreakpoint('lg');
      else if (width >= 768) setBreakpoint('md');
      else setBreakpoint('sm');
    };

    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);
    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === 'sm',
    isTablet: breakpoint === 'md',
    isDesktop: ['lg', 'xl', '2xl'].includes(breakpoint),
    isLargeScreen: ['xl', '2xl'].includes(breakpoint)
  };
};

export const useViewportSize = () => {
  const [size, setSize] = React.useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  }));

  React.useEffect(() => {
    const updateSize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return size;
};

// 🎯 Mobile-First CSS Classes Helper
export const mobileFirst = {
  // Spacing
  spacing: {
    xs: 'p-2 sm:p-3 md:p-4',
    sm: 'p-3 sm:p-4 md:p-6',
    md: 'p-4 sm:p-6 md:p-8',
    lg: 'p-6 sm:p-8 md:p-12',
  },
  
  // Typography
  typography: {
    h1: 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold',
    h2: 'text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold',
    h3: 'text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold',
    body: 'text-sm sm:text-base md:text-lg',
    caption: 'text-xs sm:text-sm'
  },
  
  // Layout
  layout: {
    container: 'px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto',
    section: 'py-8 sm:py-12 md:py-16 lg:py-20',
    card: 'p-4 sm:p-6 md:p-8 rounded-lg shadow-sm'
  }
}; 
