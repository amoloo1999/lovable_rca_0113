# RCA Wizard State Persistence & Step-Based Routing

## Overview
This update implements comprehensive state persistence and step-based routing for the Rate Comparison Analysis (RCA) wizard to prevent data loss on page refreshes and timeouts.

## Key Features

### 1. **Step-Based URL Routing**
Each wizard step now has its own unique URL:
- `/rca/step/1` - Search
- `/rca/step/2` - Subject Store
- `/rca/step/3` - Competitors
- `/rca/step/4` - Metadata
- `/rca/step/5` - Rankings
- `/rca/step/6` - Adjustments
- `/rca/step/7` - Names
- `/rca/step/8` - Data Gaps
- `/rca/step/9` - Feature Codes
- `/rca/step/10` - Data Visualization

**Benefits:**
- Users can bookmark specific steps
- Browser back/forward buttons work naturally
- Refreshing the page keeps you on the same step
- Share specific steps via URL

### 2. **LocalStorage State Persistence**
All wizard state is automatically saved to browser localStorage:
- Search criteria
- Selected stores
- Metadata and rankings
- Custom names
- Adjustment factors
- Feature codes
- All user input

**Features:**
- Automatic save on every state change
- Survives page refreshes
- Survives browser tabs being closed
- 7-day expiration for saved state
- Version checking for compatibility

### 3. **Session Keepalive**
Prevents application timeout during long analysis sessions:
- Automatic keepalive ping every 5 minutes
- Activity tracking (mouse, keyboard, scroll, touch)
- Runs in background without user interaction

### 4. **New Analysis Option**
Users can start fresh while protecting against accidental resets:
- "New Analysis" button in header
- Confirmation dialog before clearing data
- Reminds user to export data first
- Clears all saved state and returns to step 1

## Files Added

### `/client/src/lib/wizardStorage.ts`
Handles localStorage persistence:
- `saveWizardState()` - Save current state
- `loadWizardState()` - Load saved state
- `clearWizardState()` - Clear saved data
- `hasSavedState()` - Check for existing data
- `getLastSavedTimestamp()` - Get save time

### `/client/src/lib/keepalive.ts`
Prevents session timeout:
- `startKeepalive()` - Start keepalive timer
- `stopKeepalive()` - Stop keepalive timer
- `setupActivityTracking()` - Track user activity

### `/client/src/pages/RCAStepPage.tsx`
New page component for step-based routing:
- Replaces the old single-page wizard
- Handles URL parameter parsing
- Integrates state persistence
- Manages navigation between steps

## Files Modified

### `/client/src/App.tsx`
- Added routes for step-based navigation
- Redirect `/rca` to `/rca/step/1`

### `/client/src/hooks/useRCAWizard.ts`
- Added `initialStep` parameter
- Loads saved state on initialization
- Saves state on every change
- Maintains backward compatibility

### `/client/src/pages/Index.tsx`
- Updated "Start Analysis" button to point to `/rca/step/1`

## Usage

### For Users
1. **Start a new analysis:** Click "Start Analysis" on home page
2. **Progress is auto-saved:** Work at your own pace
3. **Navigate between steps:** Click progress bar or use back/forward
4. **Refresh anytime:** Your data is safe in localStorage
5. **Start fresh:** Use "New Analysis" button when needed

### For Developers
```typescript
// Initialize wizard with saved state
const { state, actions } = useRCAWizard(stepNumber);

// State is automatically persisted
actions.updateSearchCriteria({ city: 'Austin' });
// ↑ Saved to localStorage automatically

// Clear saved state
import { clearWizardState } from '@/lib/wizardStorage';
clearWizardState();
```

## Benefits

### Before
- ❌ Page refresh loses all progress
- ❌ Timeout loses all work
- ❌ Single URL for all steps
- ❌ Can't bookmark progress
- ❌ No back button support

### After
- ✅ Page refresh preserves progress
- ✅ Timeout prevention with keepalive
- ✅ Unique URL for each step
- ✅ Can bookmark any step
- ✅ Browser navigation works
- ✅ Auto-save on every change
- ✅ 7-day state retention

## Technical Details

### State Storage Format
```typescript
{
  version: "1.0",
  timestamp: 1704883200000,
  state: {
    currentStep: 3,
    searchCriteria: { /* ... */ },
    selectedStores: [ /* ... */ ],
    // ... full wizard state
  }
}
```

### Keepalive Timing
- Interval: 5 minutes
- Activity events: mousedown, keydown, scroll, touchstart
- Storage updates: localStorage timestamps

### Data Expiration
- Saved state expires after 7 days
- Automatically cleared on version mismatch
- Manual clear via "New Analysis" button

## Browser Support
- Requires localStorage (all modern browsers)
- Requires JavaScript enabled
- Falls back gracefully if localStorage unavailable

## Security & Privacy
- All data stored locally in browser
- No server-side persistence
- Data cleared on browser cache clear
- No sensitive data exposure

## Future Enhancements
- [ ] Optional cloud sync for multi-device
- [ ] Export/import state as JSON
- [ ] Compare multiple saved analyses
- [ ] Session recovery dialog on load
- [ ] Offline mode with service worker
