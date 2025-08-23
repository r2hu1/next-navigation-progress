type NavigationStatus = "idle" | "loading" | "complete" | "error";
interface NavigationStep {
    name: string;
    weight: number;
    completed: boolean;
    timestamp?: number;
}
interface NavigationProgressOptions {
    timeout?: number;
    steps?: Array<{
        name: string;
        weight: number;
    }>;
    enableAutoComplete?: boolean;
    debounceMs?: number;
    showForHashAnchor?: boolean;
    showForSamePageAnchor?: boolean;
    debug?: boolean;
}
interface NavigationProgressReturn {
    status: NavigationStatus;
    progress: number;
    duration: number;
    error?: string;
    finish: () => void;
    markStepComplete: (stepName: string) => void;
    reset: () => void;
}
declare function useNavigationProgress(options?: NavigationProgressOptions): NavigationProgressReturn;

export { NavigationProgressOptions, NavigationProgressReturn, NavigationStatus, NavigationStep, useNavigationProgress as default, useNavigationProgress };
