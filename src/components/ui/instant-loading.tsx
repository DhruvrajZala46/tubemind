// 🚀 INSTANT LOADING STATES - Zero Perceived Delay
// Ensures all button interactions feel instantly responsive

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ElegantLoader } from './elegant-loader';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

// Hook for instant loading states with zero delay
export const useInstantLoading = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  const startLoading = useCallback((text?: string) => {
    // Set loading state immediately - zero delay
    setIsLoading(true);
    setLoadingText(text || 'Loading...');
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingText('');
  }, []);

  return { isLoading, loadingText, startLoading, stopLoading };
};

// Instant Loading Button Component
interface InstantButtonProps {
  children: React.ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const InstantButton: React.FC<InstantButtonProps> = ({
  children,
  onClick,
  disabled = false,
  className = '',
  loadingText = 'Loading...',
  variant = 'primary',
  size = 'md'
}) => {
  const { isLoading, startLoading, stopLoading } = useInstantLoading();

  const handleClick = useCallback(async () => {
    if (disabled || isLoading) return;

    // Start loading immediately - zero delay
    startLoading(loadingText);

    try {
      await onClick();
    } catch (error) {
      console.error('Button action failed:', error);
    } finally {
      stopLoading();
    }
  }, [disabled, isLoading, onClick, loadingText, startLoading, stopLoading]);

  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-[#DC143C] text-white hover:bg-[#DC143C]/90 focus:ring-[#DC143C]',
    secondary: 'bg-[#21262D] text-[#F0F6FC] hover:bg-[#30363D] border border-[#30363D] focus:ring-[#58A6FF]',
    outline: 'border border-[#30363D] text-[#F0F6FC] hover:bg-[#21262D] focus:ring-[#58A6FF]',
    ghost: 'text-[#ABB2BF] hover:text-[#F0F6FC] hover:bg-[#21262D] focus:ring-[#58A6FF]'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm rounded-md',
    md: 'px-4 py-2 text-sm rounded-lg',
    lg: 'px-6 py-3 text-base rounded-lg'
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        isLoading && 'cursor-wait',
        className
      )}
    >
      {isLoading ? (
        <>
          <ElegantLoader size="sm" className="mr-2" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
};

// Instant Loading Link Component (for navigation)
interface InstantLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  loadingText?: string;
  replace?: boolean;
  onClick?: () => void;
}

export const InstantLink: React.FC<InstantLinkProps> = ({
  href,
  children,
  className = '',
  loadingText = 'Loading...',
  replace = false,
  onClick
}) => {
  const { isLoading, startLoading, stopLoading } = useInstantLoading();

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    // Start loading immediately - zero delay
    startLoading(loadingText);
    
    // Custom onClick handler
    if (onClick) {
      onClick();
    }

    // Use browser navigation for instant response
    if (replace) {
      window.history.replaceState(null, '', href);
      window.location.replace(href);
    } else {
      window.location.href = href;
    }
  }, [href, loadingText, replace, onClick, startLoading]);

  return (
    <a
      href={href}
      onClick={handleClick}
      className={cn(
        'inline-block transition-all duration-200',
        isLoading && 'cursor-wait opacity-75',
        className
      )}
    >
      {isLoading ? (
        <div className="flex items-center">
          <ElegantLoader size="sm" className="mr-2" />
          {loadingText}
        </div>
      ) : (
        children
      )}
    </a>
  );
};

// Instant Loading Card Component
interface InstantCardProps {
  children: React.ReactNode;
  onClick?: () => void | Promise<void>;
  className?: string;
  loadingText?: string;
  href?: string;
}

export const InstantCard: React.FC<InstantCardProps> = ({
  children,
  onClick,
  className = '',
  loadingText = 'Loading...',
  href
}) => {
  const { isLoading, startLoading, stopLoading } = useInstantLoading();

  const handleClick = useCallback(async () => {
    if (!onClick && !href) return;

    // Start loading immediately - zero delay
    startLoading(loadingText);

    try {
      if (href) {
        window.location.href = href;
      } else if (onClick) {
        await onClick();
      }
    } catch (error) {
      console.error('Card action failed:', error);
      stopLoading();
    }
  }, [onClick, href, loadingText, startLoading, stopLoading]);

  const Element = onClick || href ? 'button' : 'div';

  return (
    <Element
      onClick={onClick || href ? handleClick : undefined}
      className={cn(
        'w-full text-left transition-all duration-200',
        (onClick || href) && 'cursor-pointer hover:bg-[#21262D] focus:outline-none focus:ring-2 focus:ring-[#58A6FF]',
        isLoading && 'cursor-wait opacity-75',
        className
      )}
    >
      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <ElegantLoader size="sm" className="mr-2" />
          {loadingText}
        </div>
      ) : (
        children
      )}
    </Element>
  );
};

// Instant Loading Wrapper for any component
interface InstantWrapperProps {
  children: React.ReactNode;
  onAction: () => void | Promise<void>;
  loadingText?: string;
  className?: string;
}

export const InstantWrapper: React.FC<InstantWrapperProps> = ({
  children,
  onAction,
  loadingText = 'Loading...',
  className = ''
}) => {
  const { isLoading, startLoading, stopLoading } = useInstantLoading();

  const handleAction = useCallback(async () => {
    // Start loading immediately - zero delay
    startLoading(loadingText);

    try {
      await onAction();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      stopLoading();
    }
  }, [onAction, loadingText, startLoading, stopLoading]);

  return (
    <div
      onClick={handleAction}
      className={cn(
        'transition-all duration-200 cursor-pointer',
        isLoading && 'cursor-wait opacity-75',
        className
      )}
    >
      {isLoading ? (
        <div className="flex items-center justify-center">
          <ElegantLoader size="sm" className="mr-2" />
          {loadingText}
        </div>
      ) : (
        children
      )}
    </div>
  );
};

// Higher-order component for instant loading
export const withInstantLoading = <P extends object>(
  Component: React.ComponentType<P>,
  loadingText = 'Loading...'
) => {
  return React.forwardRef<any, P & { onAction?: () => void | Promise<void> }>((props, ref) => {
    const { onAction, ...componentProps } = props;
    const { isLoading, startLoading, stopLoading } = useInstantLoading();

    const handleAction = useCallback(async () => {
      if (!onAction) return;

      startLoading(loadingText);
      try {
        await onAction();
      } catch (error) {
        console.error('Component action failed:', error);
      } finally {
        stopLoading();
      }
    }, [onAction, startLoading, stopLoading]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-4">
          <ElegantLoader size="sm" className="mr-2" />
          {loadingText}
        </div>
      );
    }

    return <Component ref={ref} {...(componentProps as P)} onClick={handleAction} />;
  });
}; 