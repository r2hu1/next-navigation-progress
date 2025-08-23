/**
 * Represents the current status of navigation progress
 */
type NavigationStatus = "idle" | "loading" | "complete" | "error";
/**
 * Represents a single step in the navigation progress tracking
 */
interface NavigationStep {
    /** Human-readable name of the step */
    name: string;
    /** Relative weight of this step (higher = more impact on progress) */
    weight: number;
    /** Whether this step has been completed */
    completed: boolean;
    /** Unix timestamp when this step was completed */
    timestamp?: number;
}
/**
 * Configuration options for the navigation progress hook
 */
interface NavigationProgressOptions {
    /** Maximum time to wait for navigation completion before timing out (default: 8000ms) */
    timeout?: number;
    /** Custom steps to track during navigation. If not provided, uses default steps */
    steps?: Array<{
        name: string;
        weight: number;
    }>;
    /** Whether to automatically complete navigation when all steps are done (default: true) */
    enableAutoComplete?: boolean;
    /** Minimum time between progress updates to prevent excessive re-renders (default: 100ms) */
    debounceMs?: number;
    /** Whether to show progress for hash anchor navigation (default: false) */
    showForHashAnchor?: boolean;
    /** Whether to show progress for same-page anchor navigation (default: false) */
    showForSamePageAnchor?: boolean;
    /** Enable debug logging in development mode (default: false) */
    debug?: boolean;
}
/**
 * Return value from the navigation progress hook
 */
interface NavigationProgressReturn {
    /** Current navigation status */
    status: NavigationStatus;
    /** Progress percentage (0-100) */
    progress: number;
    /** Duration of current navigation in milliseconds */
    duration: number;
    /** Error message if navigation failed */
    error?: string;
    /** Manually complete the navigation */
    finish: () => void;
    /** Mark a specific step as completed */
    markStepComplete: (stepName: string) => void;
    /** Reset the navigation progress to idle state */
    reset: () => void;
}
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
declare function useNavigationProgress(options?: NavigationProgressOptions): NavigationProgressReturn;

export { NavigationProgressOptions, NavigationProgressReturn, NavigationStatus, NavigationStep, useNavigationProgress as default, useNavigationProgress };
