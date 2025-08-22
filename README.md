# use-navigation-progress

🚀 Production-ready navigation progress hook for Next.js App Router with **real progress tracking**.

[![npm version](https://badge.fury.io/js/use-navigation-progress.svg)](https://www.npmjs.com/package/use-navigation-progress)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

## Features

✅ **Real Progress Tracking** - No fake simulations, tracks actual navigation steps
✅ **Production Ready** - Performance optimized with RAF, debouncing, and memory leak prevention
✅ **TypeScript First** - Fully typed with excellent IntelliSense support
✅ **Flexible Configuration** - Customizable steps, timeouts, and behaviors
✅ **Zero Dependencies** - Only requires React and Next.js (peer dependencies)

## Installation

```bash
npm install use-navigation-progress
# or
yarn add use-navigation-progress
# or
pnpm add use-navigation-progress
```

## Quick Start

```tsx
'use client';
import { useNavigationProgress } from 'use-navigation-progress';

export default function NavigationBar() {
  const { status, progress } = useNavigationProgress();

  if (status !== 'loading') return null;

  return (
    <div className="fixed top-0 left-0 w-full h-1 bg-gray-200 z-50">
      <div
        className="h-full bg-blue-500 transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
```

## Advanced Usage

### Custom Steps & Manual Control

```tsx
const progress = useNavigationProgress({
  enableAutoComplete: false, // Manual control
  timeout: 15000, // 15 second timeout
  steps: [
    { name: "route_change", weight: 20 },
    { name: "auth_check", weight: 15 },
    { name: "data_fetch", weight: 40 },
    { name: "render_complete", weight: 25 }
  ]
});

// In your component
useEffect(() => {
  checkAuth()
    .then(() => progress.markStepComplete('auth_check'))
    .then(() => fetchData())
    .then(() => progress.markStepComplete('data_fetch'))
    .finally(() => progress.finish());
}, []);
```

### Complete Progress Bar Component

```tsx
'use client';
import { useNavigationProgress } from 'use-navigation-progress';

export function ProgressBar() {
  const { status, progress, duration, error } = useNavigationProgress({
    timeout: 8000,
    debounceMs: 50
  });

  if (status === 'idle') return null;

  return (
    <div className="fixed top-0 left-0 w-full z-50">
      <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-600 origin-left transform transition-transform duration-200 ease-out"
           style={{
             transform: `scaleX(${progress / 100})`,
             opacity: status === 'complete' ? 0 : 1
           }} />

      {error && (
        <div className="bg-red-500 text-white text-sm px-4 py-1">
          Navigation failed: {error}
        </div>
      )}

      {/* Optional: Show duration for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 px-2">
          {duration}ms - {progress}%
        </div>
      )}
    </div>
  );
}
```

## API Reference

### `useNavigationProgress(options?)`

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `10000` | Timeout in milliseconds before marking navigation as failed |
| `steps` | `Array<{name: string, weight: number}>` | Default steps | Custom navigation steps with weights |
| `enableAutoComplete` | `boolean` | `true` | Automatically complete progress when all steps are done |
| `debounceMs` | `number` | `100` | Debounce time in milliseconds for progress updates |

#### Returns

| Property | Type | Description |
|----------|------|-------------|
| `status` | `'idle' \| 'loading' \| 'complete' \| 'error'` | Current navigation status |
| `progress` | `number` | Progress percentage (0-100) |
| `duration` | `number` | Navigation duration in milliseconds |
| `error` | `string \| undefined` | Error message if status is "error" |
| `finish` | `() => void` | Manually finish the navigation progress |
| `markStepComplete` | `(stepName: string) => void` | Mark a specific step as complete |
| `reset` | `() => void` | Reset progress to idle state |

#### Default Steps

```typescript
[
  { name: "route_change", weight: 20 },    // Route change detected
  { name: "component_mount", weight: 30 }, // Component mounted
  { name: "hydration", weight: 25 },       // React hydration complete
  { name: "resources_load", weight: 25 }   // Images and resources loaded
]
```

## Styling Examples

### Tailwind CSS

```tsx
// Simple bar
<div className={`fixed top-0 left-0 h-1 bg-blue-500 z-50 transition-all duration-200 ${
  status === 'loading' ? 'opacity-100' : 'opacity-0'
}`} style={{ width: `${progress}%` }} />

// Gradient bar with glow
<div className="fixed top-0 left-0 w-full h-1 bg-gray-200 z-50">
  <div className="h-full bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 shadow-lg transition-all duration-300 ease-out"
       style={{ width: `${progress}%` }} />
</div>
```

### CSS Modules

```css
.progressBar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
  transform-origin: left;
  transition: transform 200ms ease-out;
  z-index: 9999;
}

.progressBar.complete {
  opacity: 0;
  transition: opacity 300ms ease-out;
}
```

## Best Practices

### 1. Single Progress Bar Per App
```tsx
// app/layout.tsx
import { ProgressBar } from '@/components/progress-bar';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ProgressBar />
        {children}
      </body>
    </html>
  );
}
```

### 2. Custom Loading Steps
```tsx
// For data-heavy pages
const { markStepComplete } = useNavigationProgress({
  steps: [
    { name: "route_change", weight: 15 },
    { name: "auth_validation", weight: 20 },
    { name: "data_prefetch", weight: 35 },
    { name: "component_render", weight: 30 }
  ]
});
```

### 3. Error Handling
```tsx
const { status, error, reset } = useNavigationProgress();

useEffect(() => {
  if (status === 'error') {
    console.error('Navigation failed:', error);
    // Optionally reset after delay
    setTimeout(reset, 3000);
  }
}, [status, error, reset]);
```

## Requirements

- **React**: >=18.0.0
- **Next.js**: >=13.0.0 (App Router)
- **TypeScript**: >=4.9.0 (optional but recommended)

## Browser Support

- **Modern browsers** (Chrome 88+, Firefox 87+, Safari 14+, Edge 88+)
- **Mobile browsers** (iOS Safari 14+, Chrome Mobile 88+)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

© [MIT](LICENSE)
