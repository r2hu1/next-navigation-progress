import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

const DEFAULT_STEPS = [
    { name: "route_change", weight: 20 },
    { name: "component_mount", weight: 30 },
    { name: "hydration", weight: 25 },
    { name: "resources_load", weight: 25 },
];
/**
 * navigation progress hook for Next.js App Router
 * author: https://github.com/r2hu1
 * source code: https://github.com/r2hu1/use-navigation-progress
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
function useNavigationProgress(options = {}) {
    const { timeout = 10000, steps = DEFAULT_STEPS, enableAutoComplete = true, debounceMs = 100, } = options;
    const pathname = usePathname();
    const [status, setStatus] = useState("idle");
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState();
    // Refs for cleanup and state management
    const prevPath = useRef(pathname);
    const startTime = useRef(null);
    const timeoutRef = useRef(null);
    const rafRef = useRef(null);
    const stepsRef = useRef([]);
    const lastUpdateTime = useRef(0);
    const isUnmounted = useRef(false);
    // Initialize steps
    useEffect(() => {
        stepsRef.current = steps.map((step) => ({
            ...step,
            completed: false,
        }));
    }, [steps]);
    // Safe state updater that checks if component is mounted
    const safeSetState = useCallback((updater) => {
        if (!isUnmounted.current) {
            updater();
        }
    }, []);
    // Debounced progress calculation
    const updateProgress = useCallback(() => {
        const now = Date.now();
        if (now - lastUpdateTime.current < debounceMs)
            return;
        lastUpdateTime.current = now;
        if (rafRef.current)
            cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            const totalWeight = stepsRef.current.reduce((sum, step) => sum + step.weight, 0);
            const completedWeight = stepsRef.current
                .filter((step) => step.completed)
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
        stepsRef.current = steps.map((step) => ({
            ...step,
            completed: false,
        }));
        safeSetState(() => {
            setStatus("idle");
            setProgress(0);
            setDuration(0);
            setError(undefined);
        });
        startTime.current = null;
    }, [steps, safeSetState]);
    // Start navigation tracking
    const startNavigation = useCallback(() => {
        reset();
        startTime.current = Date.now();
        safeSetState(() => {
            setStatus("loading");
        });
        // Mark route change as complete immediately
        markStepComplete("route_change");
        // Set timeout for navigation
        timeoutRef.current = window.setTimeout(() => {
            safeSetState(() => {
                setStatus("error");
                setError("Navigation timeout");
            });
        }, timeout);
    }, [reset, timeout, safeSetState]);
    // Mark specific step as complete
    const markStepComplete = useCallback((stepName) => {
        const step = stepsRef.current.find((s) => s.name === stepName);
        if (step && !step.completed) {
            step.completed = true;
            step.timestamp = Date.now();
            updateProgress();
        }
    }, [updateProgress]);
    // Finish navigation
    const finish = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        // Mark all steps as complete
        stepsRef.current.forEach((step) => {
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
    // Route change detection
    useEffect(() => {
        if (pathname !== prevPath.current) {
            prevPath.current = pathname;
            startNavigation();
        }
    }, [pathname, startNavigation]);
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
        if (!enableAutoComplete || status !== "loading")
            return;
        let hydrationTimer;
        let resourceTimer;
        hydrationTimer = window.setTimeout(() => {
            const componentMountStep = stepsRef.current.find((s) => s.name === "component_mount");
            if (componentMountStep?.completed) {
                markStepComplete("hydration");
            }
        }, 100);
        const checkResources = () => {
            const images = Array.from(document.images);
            const unloadedImages = images.filter((img) => !img.complete);
            if (images.length === 0 || unloadedImages.length === 0) {
                markStepComplete("resources_load");
            }
            else {
                resourceTimer = window.setTimeout(checkResources, 200);
            }
        };
        setTimeout(checkResources, 150);
        return () => {
            clearTimeout(hydrationTimer);
            clearTimeout(resourceTimer);
        };
    }, [status, enableAutoComplete, markStepComplete]);
    // Cleanup on unmount
    useEffect(() => {
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

export { useNavigationProgress as default, useNavigationProgress };
//# sourceMappingURL=index.esm.js.map
