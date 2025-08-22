"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

export type NavigationStatus = "idle" | "loading" | "complete" | "error";

export interface NavigationStep {
  name: string;
  weight: number;
  completed: boolean;
  timestamp?: number;
}

export interface NavigationProgressOptions {
  /**
   * Timeout in milliseconds before marking navigation as failed
   * @default 8000
   */
  timeout?: number;
  /**
   * Custom navigation steps with weights
   * @default predefined steps
   */
  steps?: Array<{ name: string; weight: number }>;
  /**
   * Automatically complete progress when all steps are done
   * @default true
   */
  enableAutoComplete?: boolean;
  /**
   * Debounce time in milliseconds for progress updates
   * @default 100
   */
  debounceMs?: number;
  /**
   * Show progress for hash anchor navigation
   * @default false
   */
  showForHashAnchor?: boolean;
  /**
   * Show progress for same page anchors
   * @default false
   */
  showForSamePageAnchor?: boolean;
  /**
   * Enable debug logging in development
   * @default false
   */
  debug?: boolean;
}

export interface NavigationProgressReturn {
  /** Current navigation status */
  status: NavigationStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Navigation duration in milliseconds */
  duration: number;
  /** Error message if status is "error" */
  error?: string;
  /** Manually finish the navigation progress */
  finish: () => void;
  /** Mark a specific step as complete */
  markStepComplete: (stepName: string) => void;
  /** Reset progress to idle state */
  reset: () => void;
}

const DEFAULT_STEPS = [
  { name: "route_change", weight: 20 },
  { name: "component_mount", weight: 30 },
  { name: "hydration", weight: 25 },
  { name: "resources_load", weight: 25 }
];

/**
 * Production-ready navigation progress hook for Next.js App Router
 * author: https://github.com/r2hu1
 * source: https://github.com/r2hu1/use-navigation-progress
 * 
 * @param options Configuration options for the hook
 * @returns Navigation progress state and control functions
 *
 * @example
 * ```tsx
 * const { status, progress, markStepComplete } = useNavigationProgress();
 *
 * // Use in a progress bar component
 * {status === 'loading' && (
 *   <div className="progress-bar">
 *     <div style={{ width: `${progress}%` }} />
 *   </div>
 * )}
 * ```
 */
export function useNavigationProgress(
  options: NavigationProgressOptions = {}
): NavigationProgressReturn {
  const {
    timeout = 8000, // Reduced from 10000
    steps = DEFAULT_STEPS,
    enableAutoComplete = true,
    debounceMs = 100,
    showForHashAnchor = false,
    showForSamePageAnchor = false,
    debug = false
  } = options;

  const pathname = usePathname();
  const [status, setStatus] = useState<NavigationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string>();

  // Refs for cleanup and state management
  const prevPath = useRef(pathname);
  const startTime = useRef<number | null>(null);
  const timeoutRef = useRef<any | null>(null);
  const rafRef = useRef<number | null>(null);
  const stepsRef = useRef<NavigationStep[]>([]);
  const lastUpdateTime = useRef(0);
  const isUnmounted = useRef(false);

  // Navigation detection utilities (inspired by NextTopLoader)
  const toAbsoluteURL = useCallback((url: string): string => {
    if (typeof window === 'undefined') return url;
    return new URL(url, window.location.href).href;
  }, []);

  const isHashAnchor = useCallback((currentUrl: string, newUrl: string): boolean => {
    const current = new URL(toAbsoluteURL(currentUrl));
    const next = new URL(toAbsoluteURL(newUrl));
    return current.href.split('#')[0] === next.href.split('#')[0];
  }, [toAbsoluteURL]);

  const isSameHostName = useCallback((currentUrl: string, newUrl: string): boolean => {
    const current = new URL(toAbsoluteURL(currentUrl));
    const next = new URL(toAbsoluteURL(newUrl));
    return current.hostname.replace(/^www\./, '') === next.hostname.replace(/^www\./, '');
  }, [toAbsoluteURL]);

  const isAnchorOfCurrentUrl = useCallback((currentUrl: string, newUrl: string): boolean => {
    const currentUrlObj = new URL(currentUrl);
    const newUrlObj = new URL(newUrl);

    if (
      currentUrlObj.hostname === newUrlObj.hostname &&
      currentUrlObj.pathname === newUrlObj.pathname &&
      currentUrlObj.search === newUrlObj.search
    ) {
      const currentHash = currentUrlObj.hash;
      const newHash = newUrlObj.hash;
      return (
        currentHash !== newHash &&
        currentUrlObj.href.replace(currentHash, '') === newUrlObj.href.replace(newHash, '')
      );
    }
    return false;
  }, []);

  const shouldShowProgress = useCallback((currentUrl: string, newUrl: string): boolean => {
    if (typeof window === 'undefined') return true;

    try {
      // Check for external links
      if (!isSameHostName(currentUrl, newUrl)) {
        return false;
      }

      // Check for special schemes
      const isSpecialScheme = ['tel:', 'mailto:', 'sms:', 'blob:', 'download:'].some((scheme) =>
        newUrl.startsWith(scheme)
      );
      if (isSpecialScheme) return false;

      // Check for same page navigation
      if (currentUrl === newUrl) return false;

      // Check for hash anchors
      const isHashNav = isHashAnchor(currentUrl, newUrl);
      const isSamePageNav = isAnchorOfCurrentUrl(currentUrl, newUrl);

      if (isHashNav && !showForHashAnchor) return false;
      if (isSamePageNav && !showForSamePageAnchor) return false;

      // Check for non-http URLs
      if (!toAbsoluteURL(newUrl).startsWith('http')) return false;

      return true;
    } catch (err) {
      // On error, show progress to be safe
      return true;
    }
  }, [isSameHostName, isHashAnchor, isAnchorOfCurrentUrl, showForHashAnchor, showForSamePageAnchor, toAbsoluteURL]);

  // Initialize steps
  useEffect(() => {
    stepsRef.current = steps.map(step => ({
      ...step,
      completed: false
    }));
  }, [steps]);

  // Safe state updater that checks if component is mounted
  const safeSetState = useCallback((updater: () => void) => {
    if (!isUnmounted.current) {
      updater();
    }
  }, []);

  // Debounced progress calculation
  const updateProgress = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateTime.current < debounceMs) return;
    lastUpdateTime.current = now;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      const totalWeight = stepsRef.current.reduce((sum, step) => sum + step.weight, 0);
      const completedWeight = stepsRef.current
        .filter(step => step.completed)
        .reduce((sum, step) => sum + step.weight, 0);

      const newProgress = Math.min(Math.round((completedWeight / totalWeight) * 100), 100);

      safeSetState(() => {
        setProgress(newProgress);
        if (startTime.current) {
          setDuration(Date.now() - startTime.current);
        }
      });

      // Auto-complete if all steps done
      if (enableAutoComplete && newProgress === 100 && status === "loading") {
        setTimeout(() => finish(), 50);
      }
    });
  }, [debounceMs, enableAutoComplete, status, safeSetState]);

  // Reset all state
  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    stepsRef.current = steps.map(step => ({
      ...step,
      completed: false
    }));

    safeSetState(() => {
      setStatus("idle");
      setProgress(0);
      setDuration(0);
      setError(undefined);
    });

    startTime.current = null;
  }, [steps, safeSetState]);

  // Mark specific step as complete
  const markStepComplete = useCallback((stepName: string) => {
	const step = stepsRef.current.find(s => s.name === stepName);
	if (step && !step.completed) {
	  step.completed = true;
	  step.timestamp = Date.now();

	  if (debug && process.env.NODE_ENV === 'development') {
		console.log(`Navigation progress: Step completed - ${stepName}`);
	  }

	  updateProgress();
	}
  }, [updateProgress, debug]);
  
  // Start navigation tracking
  const startNavigation = useCallback(() => {
    if (debug && process.env.NODE_ENV === 'development') {
      console.log('Navigation progress: Starting navigation');
    }

    reset();
    startTime.current = Date.now();

    safeSetState(() => {
      setStatus("loading");
    });

    // Mark route change as complete immediately
    setTimeout(() => markStepComplete("route_change"), 10);

    // Set timeout for navigation
    timeoutRef.current = setTimeout(() => {
      if (debug && process.env.NODE_ENV === 'development') {
        const incompleteSteps = stepsRef.current.filter(s => !s.completed);
        console.warn('Navigation progress: Timeout reached. Incomplete steps:', incompleteSteps.map(s => s.name));
      }

      safeSetState(() => {
        setStatus("error");
        setError("Navigation timeout");
      });
    }, timeout);
  }, [reset, timeout, safeSetState, markStepComplete, debug]);


  // Finish navigation
  const finish = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Mark all steps as complete
    stepsRef.current.forEach(step => {
      step.completed = true;
      step.timestamp = step.timestamp || Date.now();
    });

    safeSetState(() => {
      setProgress(100);
      setStatus("complete");
    });

    // Reset to idle after animation
    setTimeout(() => {
      safeSetState(() => {
        setStatus("idle");
        setProgress(0);
        setDuration(0);
        setError(undefined);
      });
    }, 300);
  }, [safeSetState]);

  // Find closest anchor element
  const findClosestAnchor = useCallback((element: HTMLElement | null): HTMLAnchorElement | null => {
    while (element && element.tagName.toLowerCase() !== 'a') {
      element = element.parentElement;
    }
    return element as HTMLAnchorElement;
  }, []);

  // Handle click events for navigation detection
  const handleClick = useCallback((event: MouseEvent) => {
    if (typeof window === 'undefined') return;

    try {
      const target = event.target as HTMLElement;
      const anchor = findClosestAnchor(target);

      if (!anchor?.href) return;

      const currentUrl = window.location.href;
      const newUrl = anchor.href;

      // Check for modifier keys (ctrl, cmd, shift, alt) or external target
      const isExternalLink = anchor.target !== '';
      const hasModifierKey = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;

      if (isExternalLink || hasModifierKey) {
        return; // Don't show progress for these
      }

      if (shouldShowProgress(currentUrl, newUrl)) {
        startNavigation();
      }
    } catch (err) {
      // On error, start navigation to be safe
      startNavigation();
    }
  }, [findClosestAnchor, shouldShowProgress, startNavigation]);

  // Route change detection (fallback for programmatic navigation)
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;

      // Only start if not already loading (avoid double-triggering)
      if (status !== "loading") {
        startNavigation();
      }
    }
  }, [pathname, status, startNavigation]);

  // Setup click event listener and history monitoring
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Add click listener
    document.addEventListener('click', handleClick);

    // Monitor history changes (similar to NextTopLoader)
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(...args) {
      finish();
      return originalPushState.apply(this, args);
    };

    window.history.replaceState = function(...args) {
      finish();
      return originalReplaceState.apply(this, args);
    };

    // Handle browser back/forward
    const handlePopState = () => finish();
    const handlePageHide = () => finish();

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pagehide', handlePageHide);

      // Restore original history methods
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [handleClick, finish]);

  // Auto-detect component mount
  useEffect(() => {
    if (status === "loading") {
      const timer = setTimeout(() => {
        markStepComplete("component_mount");
      }, 16);

      return () => clearTimeout(timer);
    }
  }, [status, markStepComplete]);

  // Auto-detect hydration and resource loading
  useEffect(() => {
    if (!enableAutoComplete || status !== "loading") return;

    let hydrationTimer: any;
    let resourceTimer: any;
    let fallbackTimer: any;

    // Mark hydration complete after component mount
    hydrationTimer = setTimeout(() => {
      const componentMountStep = stepsRef.current.find(s => s.name === "component_mount");
      if (componentMountStep?.completed) {
        markStepComplete("hydration");
      }
    }, 100);

    // Check resources with timeout fallback
    const checkResources = () => {
      if (typeof document === 'undefined') {
        markStepComplete("resources_load");
        return;
      }

      const images = Array.from(document.images);
      const unloadedImages = images.filter(img => !img.complete && img.src);

      if (images.length === 0 || unloadedImages.length === 0) {
        markStepComplete("resources_load");
      } else if (unloadedImages.length > 0) {
        // Set a reasonable timeout for image loading
        resourceTimer = setTimeout(() => {
          // Force complete resources after reasonable wait
          markStepComplete("resources_load");
        }, 2000); // 2 second timeout for images
      }
    };

    // Start resource checking
    setTimeout(checkResources, 150);

    // Fallback: Force completion if taking too long
    fallbackTimer = setTimeout(() => {
      // Mark all remaining steps as complete
      const incompleteSteps = stepsRef.current.filter(step => !step.completed);
      incompleteSteps.forEach(step => {
        markStepComplete(step.name);
      });

      if (process.env.NODE_ENV === 'development') {
        console.warn('Navigation progress: Auto-completed due to fallback timer');
      }
    }, 3000); // 3 second fallback

    return () => {
      clearTimeout(hydrationTimer);
      clearTimeout(resourceTimer);
      clearTimeout(fallbackTimer);
    };
  }, [status, enableAutoComplete, markStepComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmounted.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    status,
    progress,
    duration,
    error,
    finish,
    markStepComplete,
    reset
  };
}

// Export default
export default useNavigationProgress;
