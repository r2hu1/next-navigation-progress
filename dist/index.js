'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var react = require('react');
var navigation = require('next/navigation');

/**
 * Default navigation steps with their respective weights
 * These represent typical phases of a Next.js page navigation
 */
const DEFAULT_STEPS = [
    { name: "route_change", weight: 20 },
    { name: "component_mount", weight: 30 },
    { name: "hydration", weight: 25 },
    { name: "resources_load", weight: 25 }, // Images and other resources loading
];
/**
 * Custom React hook for tracking navigation progress in Next.js applications
 *
 * This hook provides real-time progress tracking for page navigation, including
 * automatic detection of navigation events, customizable progress steps, and
 * intelligent handling of different navigation types (full page, hash anchors, etc.).
 *
 * @param options - Configuration options for the navigation progress tracker
 * @returns Object containing navigation status, progress, and control functions
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { status, progress } = useNavigationProgress();
 *
 * return (
 *   <div>
 *     {status === 'loading' && (
 *       <div className="progress-bar">
 *         <div style={{ width: `${progress}%` }} />
 *       </div>
 *     )}
 *   </div>
 * );
 * ```
 *
 * @example
 * ```tsx
 * // Advanced usage with custom steps
 * const { status, progress, markStepComplete } = useNavigationProgress({
 *   steps: [
 *     { name: "auth_check", weight: 25 },
 *     { name: "data_fetch", weight: 50 },
 *     { name: "render", weight: 25 }
 *   ],
 *   timeout: 10000,
 *   debug: true
 * });
 *
 * // Manually mark steps complete
 * useEffect(() => {
 *   checkAuthentication().then(() => {
 *     markStepComplete("auth_check");
 *   });
 * }, [markStepComplete]);
 * ```
 */
function useNavigationProgress(options = {}) {
    const { timeout = 8000, steps = DEFAULT_STEPS, enableAutoComplete = true, debounceMs = 100, showForHashAnchor = false, showForSamePageAnchor = false, debug = false, } = options;
    // Next.js router pathname for detecting route changes
    const pathname = navigation.usePathname();
    // Component state
    const [status, setStatus] = react.useState("idle");
    const [progress, setProgress] = react.useState(0);
    const [duration, setDuration] = react.useState(0);
    const [error, setError] = react.useState();
    // Refs for cleanup and state management
    /** Previous pathname to detect route changes */
    const prevPath = react.useRef(pathname);
    /** Navigation start timestamp */
    const startTime = react.useRef(null);
    /** Timeout reference for navigation timeout */
    const timeoutRef = react.useRef(null);
    /** Request animation frame reference for smooth progress updates */
    const rafRef = react.useRef(null);
    /** Current navigation steps with completion status */
    const stepsRef = react.useRef([]);
    /** Last progress update timestamp for debouncing */
    const lastUpdateTime = react.useRef(0);
    /** Flag to prevent state updates after component unmount */
    const isUnmounted = react.useRef(false);
    /** Flag to prevent multiple simultaneous progress updates */
    react.useRef(false);
    /**
     * Converts a relative URL to an absolute URL
     * @param url - The URL to convert
     * @returns Absolute URL string
     */
    const toAbsoluteURL = react.useCallback((url) => {
        if (typeof window === "undefined")
            return url;
        try {
            return new URL(url, window.location.href).href;
        }
        catch {
            return url;
        }
    }, []);
    /**
     * Checks if navigation is between hash anchors on the same page
     * @param currentUrl - Current page URL
     * @param newUrl - Target navigation URL
     * @returns True if this is hash anchor navigation
     */
    const isHashAnchor = react.useCallback((currentUrl, newUrl) => {
        try {
            const current = new URL(toAbsoluteURL(currentUrl));
            const next = new URL(toAbsoluteURL(newUrl));
            return current.href.split("#")[0] === next.href.split("#")[0];
        }
        catch {
            return false;
        }
    }, [toAbsoluteURL]);
    /**
     * Checks if two URLs have the same hostname (ignoring www prefix)
     * @param currentUrl - Current page URL
     * @param newUrl - Target navigation URL
     * @returns True if hostnames match
     */
    const isSameHostName = react.useCallback((currentUrl, newUrl) => {
        try {
            const current = new URL(toAbsoluteURL(currentUrl));
            const next = new URL(toAbsoluteURL(newUrl));
            return (current.hostname.replace(/^www\./, "") ===
                next.hostname.replace(/^www\./, ""));
        }
        catch {
            return false;
        }
    }, [toAbsoluteURL]);
    /**
     * Checks if the new URL is an anchor link within the current page
     * @param currentUrl - Current page URL
     * @param newUrl - Target navigation URL
     * @returns True if this is same-page anchor navigation
     */
    const isAnchorOfCurrentUrl = react.useCallback((currentUrl, newUrl) => {
        try {
            const currentUrlObj = new URL(currentUrl);
            const newUrlObj = new URL(newUrl);
            if (currentUrlObj.hostname === newUrlObj.hostname &&
                currentUrlObj.pathname === newUrlObj.pathname &&
                currentUrlObj.search === newUrlObj.search) {
                const currentHash = currentUrlObj.hash;
                const newHash = newUrlObj.hash;
                return (currentHash !== newHash &&
                    currentUrlObj.href.replace(currentHash, "") ===
                        newUrlObj.href.replace(newHash, ""));
            }
            return false;
        }
        catch {
            return false;
        }
    }, []);
    /**
     * Determines whether progress should be shown for a given navigation
     * @param currentUrl - Current page URL
     * @param newUrl - Target navigation URL
     * @returns True if progress should be displayed
     */
    const shouldShowProgress = react.useCallback((currentUrl, newUrl) => {
        if (typeof window === "undefined")
            return true;
        try {
            // Don't show for external links
            if (!isSameHostName(currentUrl, newUrl))
                return false;
            // Don't show for special protocol links
            const isSpecialScheme = [
                "tel:",
                "mailto:",
                "sms:",
                "blob:",
                "download:",
            ].some((scheme) => newUrl.startsWith(scheme));
            if (isSpecialScheme)
                return false;
            // Don't show for same URL
            if (currentUrl === newUrl)
                return false;
            const isHashNav = isHashAnchor(currentUrl, newUrl);
            const isSamePageNav = isAnchorOfCurrentUrl(currentUrl, newUrl);
            // Respect configuration for hash and same-page navigation
            if (isHashNav && !showForHashAnchor)
                return false;
            if (isSamePageNav && !showForSamePageAnchor)
                return false;
            // Only show for HTTP(S) URLs
            if (!toAbsoluteURL(newUrl).startsWith("http"))
                return false;
            return true;
        }
        catch {
            return true;
        }
    }, [
        isSameHostName,
        isHashAnchor,
        isAnchorOfCurrentUrl,
        showForHashAnchor,
        showForSamePageAnchor,
        toAbsoluteURL,
    ]);
    // Initialize steps when configuration changes
    react.useEffect(() => {
        stepsRef.current = steps.map((step) => ({
            ...step,
            completed: false,
        }));
    }, [steps]);
    /**
     * Safe state updater that prevents useInsertionEffect conflicts
     * Uses setTimeout to defer updates after insertion effects complete
     * @param updater - Function that updates state
     */
    react.useCallback((updater) => {
        if (isUnmounted.current)
            return;
        // Use flushSync to avoid useInsertionEffect conflicts
        // This ensures updates happen after insertion effects complete
        setTimeout(() => {
            if (!isUnmounted.current) {
                updater();
            }
        }, 0);
    }, []);
    /**
     * Calculates and updates the current progress percentage
     * Uses debouncing and RAF for smooth, efficient updates
     */
    const updateProgress = react.useCallback(() => {
        const now = Date.now();
        if (now - lastUpdateTime.current < debounceMs)
            return;
        lastUpdateTime.current = now;
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        rafRef.current = requestAnimationFrame(() => {
            if (isUnmounted.current)
                return;
            const totalWeight = stepsRef.current.reduce((sum, step) => sum + step.weight, 0);
            const completedWeight = stepsRef.current
                .filter((step) => step.completed)
                .reduce((sum, step) => sum + step.weight, 0);
            const newProgress = Math.min(Math.round((completedWeight / totalWeight) * 100), 100);
            // Defer state updates to avoid useInsertionEffect conflicts
            setTimeout(() => {
                if (!isUnmounted.current) {
                    setProgress(newProgress);
                    if (startTime.current) {
                        setDuration(Date.now() - startTime.current);
                    }
                    // Auto-complete if all steps done
                    if (enableAutoComplete &&
                        newProgress === 100 &&
                        status === "loading") {
                        setTimeout(() => finish(), 50);
                    }
                }
            }, 0);
            rafRef.current = null;
        });
    }, [debounceMs, enableAutoComplete, status]);
    /**
     * Resets all navigation progress state to initial values
     */
    const reset = react.useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        stepsRef.current = steps.map((step) => ({
            ...step,
            completed: false,
        }));
        if (!isUnmounted.current) {
            setStatus("idle");
            setProgress(0);
            setDuration(0);
            setError(undefined);
        }
        startTime.current = null;
    }, [steps]);
    /**
     * Marks a specific navigation step as completed
     * @param stepName - Name of the step to mark as complete
     *
     * @example
     * ```tsx
     * const { markStepComplete } = useNavigationProgress();
     *
     * // Mark data fetching complete
     * useEffect(() => {
     *   fetchData().then(() => {
     *     markStepComplete("data_fetch");
     *   });
     * }, [markStepComplete]);
     * ```
     */
    const markStepComplete = react.useCallback((stepName) => {
        if (isUnmounted.current)
            return;
        const step = stepsRef.current.find((s) => s.name === stepName);
        if (step && !step.completed) {
            step.completed = true;
            step.timestamp = Date.now();
            if (debug && process.env.NODE_ENV === "development") {
                console.log(`Navigation progress: Step completed - ${stepName}`);
            }
            updateProgress();
        }
    }, [updateProgress, debug]);
    /**
     * Starts navigation progress tracking
     * Called automatically when navigation is detected
     */
    const startNavigation = react.useCallback(() => {
        if (isUnmounted.current)
            return;
        if (debug && process.env.NODE_ENV === "development") {
            console.log("Navigation progress: Starting navigation");
        }
        reset();
        startTime.current = Date.now();
        // Defer state update to avoid useInsertionEffect conflicts
        setTimeout(() => {
            if (!isUnmounted.current) {
                setStatus("loading");
            }
        }, 0);
        // Mark route change as complete immediately
        setTimeout(() => markStepComplete("route_change"), 10);
        // Set timeout for navigation
        timeoutRef.current = setTimeout(() => {
            if (isUnmounted.current)
                return;
            if (debug && process.env.NODE_ENV === "development") {
                const incompleteSteps = stepsRef.current.filter((s) => !s.completed);
                console.warn("Navigation progress: Timeout reached. Incomplete steps:", incompleteSteps.map((s) => s.name));
            }
            // Defer error state update
            setTimeout(() => {
                if (!isUnmounted.current) {
                    setStatus("error");
                    setError("Navigation timeout");
                }
            }, 0);
        }, timeout);
    }, [reset, timeout, markStepComplete, debug]);
    /**
     * Manually completes the navigation progress
     * Can be called to force completion when navigation is done
     *
     * @example
     * ```tsx
     * const { finish } = useNavigationProgress();
     *
     * // Force completion after critical resources load
     * useEffect(() => {
     *   if (allCriticalResourcesLoaded) {
     *     finish();
     *   }
     * }, [allCriticalResourcesLoaded, finish]);
     * ```
     */
    const finish = react.useCallback(() => {
        if (isUnmounted.current)
            return;
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        // Mark all steps as complete
        stepsRef.current.forEach((step) => {
            step.completed = true;
            step.timestamp = step.timestamp || Date.now();
        });
        // Defer state updates to avoid useInsertionEffect conflicts
        setTimeout(() => {
            if (!isUnmounted.current) {
                setProgress(100);
                setStatus("complete");
                // Reset to idle after animation
                setTimeout(() => {
                    if (!isUnmounted.current) {
                        setStatus("idle");
                        setProgress(0);
                        setDuration(0);
                        setError(undefined);
                    }
                }, 300);
            }
        }, 0);
    }, []);
    /**
     * Finds the closest anchor element in the DOM tree
     * @param element - Starting HTML element
     * @returns Closest anchor element or null
     */
    const findClosestAnchor = react.useCallback((element) => {
        while (element && element.tagName.toLowerCase() !== "a") {
            element = element.parentElement;
        }
        return element;
    }, []);
    /**
     * Handles click events to detect link navigation
     * @param event - Mouse click event
     */
    const handleClick = react.useCallback((event) => {
        if (typeof window === "undefined" || isUnmounted.current)
            return;
        try {
            const target = event.target;
            const anchor = findClosestAnchor(target);
            if (!anchor?.href)
                return;
            const currentUrl = window.location.href;
            const newUrl = anchor.href;
            const isExternalLink = anchor.target !== "";
            const hasModifierKey = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
            if (isExternalLink || hasModifierKey)
                return;
            if (shouldShowProgress(currentUrl, newUrl)) {
                startNavigation();
            }
        }
        catch {
            startNavigation();
        }
    }, [findClosestAnchor, shouldShowProgress, startNavigation]);
    // Detect route changes via Next.js pathname changes
    react.useEffect(() => {
        if (pathname !== prevPath.current) {
            prevPath.current = pathname;
            if (status !== "loading") {
                startNavigation();
            }
        }
    }, [pathname, status, startNavigation]);
    // Setup global event listeners for navigation detection
    react.useEffect(() => {
        if (typeof window === "undefined")
            return;
        document.addEventListener("click", handleClick);
        // Intercept history API calls
        const originalPushState = window.history.pushState;
        const originalReplaceState = window.history.replaceState;
        window.history.pushState = function (...args) {
            finish();
            return originalPushState.apply(this, args);
        };
        window.history.replaceState = function (...args) {
            finish();
            return originalReplaceState.apply(this, args);
        };
        const handlePopState = () => finish();
        const handlePageHide = () => finish();
        window.addEventListener("popstate", handlePopState);
        window.addEventListener("pagehide", handlePageHide);
        return () => {
            document.removeEventListener("click", handleClick);
            window.removeEventListener("popstate", handlePopState);
            window.removeEventListener("pagehide", handlePageHide);
            window.history.pushState = originalPushState;
            window.history.replaceState = originalReplaceState;
        };
    }, [handleClick, finish]);
    // Auto-detect component mount step
    react.useEffect(() => {
        if (status === "loading" && !isUnmounted.current) {
            const timer = setTimeout(() => {
                markStepComplete("component_mount");
            }, 16);
            return () => clearTimeout(timer);
        }
    }, [status, markStepComplete]);
    // Auto-detect hydration and resource loading steps
    react.useEffect(() => {
        if (!enableAutoComplete || status !== "loading" || isUnmounted.current)
            return;
        let hydrationTimer;
        let resourceTimer;
        let fallbackTimer;
        // Mark hydration complete after component mount
        hydrationTimer = setTimeout(() => {
            if (isUnmounted.current)
                return;
            const componentMountStep = stepsRef.current.find((s) => s.name === "component_mount");
            if (componentMountStep?.completed) {
                markStepComplete("hydration");
            }
        }, 100);
        // Check if resources (mainly images) are loaded
        const checkResources = () => {
            if (isUnmounted.current)
                return;
            if (typeof document === "undefined") {
                markStepComplete("resources_load");
                return;
            }
            const images = Array.from(document.images);
            const unloadedImages = images.filter((img) => !img.complete && img.src);
            if (images.length === 0 || unloadedImages.length === 0) {
                markStepComplete("resources_load");
            }
            else if (unloadedImages.length > 0) {
                resourceTimer = setTimeout(() => {
                    if (!isUnmounted.current) {
                        markStepComplete("resources_load");
                    }
                }, 2000);
            }
        };
        setTimeout(checkResources, 150);
        // Fallback timer to complete all remaining steps
        fallbackTimer = setTimeout(() => {
            if (isUnmounted.current)
                return;
            const incompleteSteps = stepsRef.current.filter((step) => !step.completed);
            incompleteSteps.forEach((step) => {
                markStepComplete(step.name);
            });
            if (process.env.NODE_ENV === "development") {
                console.warn("Navigation progress: Auto-completed due to fallback timer");
            }
        }, 3000);
        return () => {
            clearTimeout(hydrationTimer);
            clearTimeout(resourceTimer);
            clearTimeout(fallbackTimer);
        };
    }, [status, enableAutoComplete, markStepComplete]);
    // Cleanup on component unmount
    react.useEffect(() => {
        return () => {
            isUnmounted.current = true;
            if (timeoutRef.current)
                clearTimeout(timeoutRef.current);
            if (rafRef.current)
                cancelAnimationFrame(rafRef.current);
        };
    }, []);
    return {
        status,
        progress,
        duration,
        error,
        finish,
        markStepComplete,
        reset,
    };
}

exports.default = useNavigationProgress;
exports.useNavigationProgress = useNavigationProgress;
