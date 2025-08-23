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
	timeout?: number;
	steps?: Array<{ name: string; weight: number }>;
	enableAutoComplete?: boolean;
	debounceMs?: number;
	showForHashAnchor?: boolean;
	showForSamePageAnchor?: boolean;
	debug?: boolean;
}

export interface NavigationProgressReturn {
	status: NavigationStatus;
	progress: number;
	duration: number;
	error?: string;
	finish: () => void;
	markStepComplete: (stepName: string) => void;
	reset: () => void;
}

const DEFAULT_STEPS = [
	{ name: "route_change", weight: 20 },
	{ name: "component_mount", weight: 30 },
	{ name: "hydration", weight: 25 },
	{ name: "resources_load", weight: 25 },
];

export function useNavigationProgress(
	options: NavigationProgressOptions = {},
): NavigationProgressReturn {
	const {
		timeout = 8000,
		steps = DEFAULT_STEPS,
		enableAutoComplete = true,
		debounceMs = 100,
		showForHashAnchor = false,
		showForSamePageAnchor = false,
		debug = false,
	} = options;

	const pathname = usePathname();
	const [status, setStatus] = useState<NavigationStatus>("idle");
	const [progress, setProgress] = useState(0);
	const [duration, setDuration] = useState(0);
	const [error, setError] = useState<string>();

	// Refs for cleanup and state management
	const prevPath = useRef(pathname);
	const startTime = useRef<number | null>(null);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const rafRef = useRef<number | null>(null);
	const stepsRef = useRef<NavigationStep[]>([]);
	const lastUpdateTime = useRef(0);
	const isUnmounted = useRef(false);
	const updateScheduled = useRef(false);

	// Navigation detection utilities
	const toAbsoluteURL = useCallback((url: string): string => {
		if (typeof window === "undefined") return url;
		try {
			return new URL(url, window.location.href).href;
		} catch {
			return url;
		}
	}, []);

	const isHashAnchor = useCallback(
		(currentUrl: string, newUrl: string): boolean => {
			try {
				const current = new URL(toAbsoluteURL(currentUrl));
				const next = new URL(toAbsoluteURL(newUrl));
				return current.href.split("#")[0] === next.href.split("#")[0];
			} catch {
				return false;
			}
		},
		[toAbsoluteURL],
	);

	const isSameHostName = useCallback(
		(currentUrl: string, newUrl: string): boolean => {
			try {
				const current = new URL(toAbsoluteURL(currentUrl));
				const next = new URL(toAbsoluteURL(newUrl));
				return (
					current.hostname.replace(/^www\./, "") ===
					next.hostname.replace(/^www\./, "")
				);
			} catch {
				return false;
			}
		},
		[toAbsoluteURL],
	);

	const isAnchorOfCurrentUrl = useCallback(
		(currentUrl: string, newUrl: string): boolean => {
			try {
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
						currentUrlObj.href.replace(currentHash, "") ===
							newUrlObj.href.replace(newHash, "")
					);
				}
				return false;
			} catch {
				return false;
			}
		},
		[],
	);

	const shouldShowProgress = useCallback(
		(currentUrl: string, newUrl: string): boolean => {
			if (typeof window === "undefined") return true;

			try {
				if (!isSameHostName(currentUrl, newUrl)) return false;

				const isSpecialScheme = [
					"tel:",
					"mailto:",
					"sms:",
					"blob:",
					"download:",
				].some((scheme) => newUrl.startsWith(scheme));
				if (isSpecialScheme) return false;

				if (currentUrl === newUrl) return false;

				const isHashNav = isHashAnchor(currentUrl, newUrl);
				const isSamePageNav = isAnchorOfCurrentUrl(currentUrl, newUrl);

				if (isHashNav && !showForHashAnchor) return false;
				if (isSamePageNav && !showForSamePageAnchor) return false;

				if (!toAbsoluteURL(newUrl).startsWith("http")) return false;

				return true;
			} catch {
				return true;
			}
		},
		[
			isSameHostName,
			isHashAnchor,
			isAnchorOfCurrentUrl,
			showForHashAnchor,
			showForSamePageAnchor,
			toAbsoluteURL,
		],
	);

	// Initialize steps
	useEffect(() => {
		stepsRef.current = steps.map((step) => ({
			...step,
			completed: false,
		}));
	}, [steps]);

	// Safe state updater that avoids useInsertionEffect conflicts
	const safeSetState = useCallback((updater: () => void) => {
		if (isUnmounted.current) return;

		// Use flushSync to avoid useInsertionEffect conflicts
		// This ensures updates happen after insertion effects complete
		setTimeout(() => {
			if (!isUnmounted.current) {
				updater();
			}
		}, 0);
	}, []);

	// Debounced progress calculation
	const updateProgress = useCallback(() => {
		const now = Date.now();
		if (now - lastUpdateTime.current < debounceMs) return;
		lastUpdateTime.current = now;

		if (rafRef.current) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}

		rafRef.current = requestAnimationFrame(() => {
			if (isUnmounted.current) return;

			const totalWeight = stepsRef.current.reduce(
				(sum, step) => sum + step.weight,
				0,
			);
			const completedWeight = stepsRef.current
				.filter((step) => step.completed)
				.reduce((sum, step) => sum + step.weight, 0);

			const newProgress = Math.min(
				Math.round((completedWeight / totalWeight) * 100),
				100,
			);

			// Defer state updates to avoid useInsertionEffect conflicts
			setTimeout(() => {
				if (!isUnmounted.current) {
					setProgress(newProgress);
					if (startTime.current) {
						setDuration(Date.now() - startTime.current);
					}

					// Auto-complete if all steps done
					if (
						enableAutoComplete &&
						newProgress === 100 &&
						status === "loading"
					) {
						setTimeout(() => finish(), 50);
					}
				}
			}, 0);

			rafRef.current = null;
		});
	}, [debounceMs, enableAutoComplete, status]);

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

		if (!isUnmounted.current) {
			setStatus("idle");
			setProgress(0);
			setDuration(0);
			setError(undefined);
		}

		startTime.current = null;
	}, [steps]);

	// Mark specific step as complete
	const markStepComplete = useCallback(
		(stepName: string) => {
			if (isUnmounted.current) return;

			const step = stepsRef.current.find((s) => s.name === stepName);
			if (step && !step.completed) {
				step.completed = true;
				step.timestamp = Date.now();

				if (debug && process.env.NODE_ENV === "development") {
					console.log(`Navigation progress: Step completed - ${stepName}`);
				}

				updateProgress();
			}
		},
		[updateProgress, debug],
	);

	// Start navigation tracking
	const startNavigation = useCallback(() => {
		if (isUnmounted.current) return;

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
			if (isUnmounted.current) return;

			if (debug && process.env.NODE_ENV === "development") {
				const incompleteSteps = stepsRef.current.filter((s) => !s.completed);
				console.warn(
					"Navigation progress: Timeout reached. Incomplete steps:",
					incompleteSteps.map((s) => s.name),
				);
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

	// Finish navigation
	const finish = useCallback(() => {
		if (isUnmounted.current) return;

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

	// Find closest anchor element
	const findClosestAnchor = useCallback(
		(element: HTMLElement | null): HTMLAnchorElement | null => {
			while (element && element.tagName.toLowerCase() !== "a") {
				element = element.parentElement;
			}
			return element as HTMLAnchorElement;
		},
		[],
	);

	// Handle click events for navigation detection
	const handleClick = useCallback(
		(event: MouseEvent) => {
			if (typeof window === "undefined" || isUnmounted.current) return;

			try {
				const target = event.target as HTMLElement;
				const anchor = findClosestAnchor(target);

				if (!anchor?.href) return;

				const currentUrl = window.location.href;
				const newUrl = anchor.href;

				const isExternalLink = anchor.target !== "";
				const hasModifierKey =
					event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;

				if (isExternalLink || hasModifierKey) return;

				if (shouldShowProgress(currentUrl, newUrl)) {
					startNavigation();
				}
			} catch {
				startNavigation();
			}
		},
		[findClosestAnchor, shouldShowProgress, startNavigation],
	);

	// Route change detection
	useEffect(() => {
		if (pathname !== prevPath.current) {
			prevPath.current = pathname;
			if (status !== "loading") {
				startNavigation();
			}
		}
	}, [pathname, status, startNavigation]);

	// Setup event listeners
	useEffect(() => {
		if (typeof window === "undefined") return;

		document.addEventListener("click", handleClick);

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

	// Auto-detect component mount
	useEffect(() => {
		if (status === "loading" && !isUnmounted.current) {
			const timer = setTimeout(() => {
				markStepComplete("component_mount");
			}, 16);
			return () => clearTimeout(timer);
		}
	}, [status, markStepComplete]);

	// Auto-detect hydration and resource loading
	useEffect(() => {
		if (!enableAutoComplete || status !== "loading" || isUnmounted.current)
			return;

		let hydrationTimer: NodeJS.Timeout;
		let resourceTimer: NodeJS.Timeout;
		let fallbackTimer: NodeJS.Timeout;

		hydrationTimer = setTimeout(() => {
			if (isUnmounted.current) return;
			const componentMountStep = stepsRef.current.find(
				(s) => s.name === "component_mount",
			);
			if (componentMountStep?.completed) {
				markStepComplete("hydration");
			}
		}, 100);

		const checkResources = () => {
			if (isUnmounted.current) return;

			if (typeof document === "undefined") {
				markStepComplete("resources_load");
				return;
			}

			const images = Array.from(document.images);
			const unloadedImages = images.filter((img) => !img.complete && img.src);

			if (images.length === 0 || unloadedImages.length === 0) {
				markStepComplete("resources_load");
			} else if (unloadedImages.length > 0) {
				resourceTimer = setTimeout(() => {
					if (!isUnmounted.current) {
						markStepComplete("resources_load");
					}
				}, 2000);
			}
		};

		setTimeout(checkResources, 150);

		fallbackTimer = setTimeout(() => {
			if (isUnmounted.current) return;

			const incompleteSteps = stepsRef.current.filter(
				(step) => !step.completed,
			);
			incompleteSteps.forEach((step) => {
				markStepComplete(step.name);
			});

			if (process.env.NODE_ENV === "development") {
				console.warn(
					"Navigation progress: Auto-completed due to fallback timer",
				);
			}
		}, 3000);

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
		reset,
	};
}

export default useNavigationProgress;
