type NavigationStatus = "idle" | "loading" | "complete" | "error";
interface NavigationStep {
    name: string;
    weight: number;
    completed: boolean;
    timestamp?: number;
}
interface NavigationProgressOptions {
    /**
     * Timeout in milliseconds before marking navigation as failed
     * @default 10000
     */
    timeout?: number;
    /**
     * Custom navigation steps with weights
     * @default predefined steps
     */
    steps?: Array<{
        name: string;
        weight: number;
    }>;
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
}
interface NavigationProgressReturn {
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
declare function useNavigationProgress(options?: NavigationProgressOptions): NavigationProgressReturn;

export { NavigationProgressOptions, NavigationProgressReturn, NavigationStatus, NavigationStep, useNavigationProgress as default, useNavigationProgress };
