# Tab Switch Detection Fix - Technical Notes

## Problem Identified
Multiple users were experiencing false positive tab switch detections in the Tech Escape Room, receiving penalties even when they never switched tabs or left the page.

## Root Causes Found
1. **Multiple Overlapping Event Sources**: The system used 4 different event listeners (`visibilitychange`, `blur/focus`, `pagehide/pageshow`) that could fire simultaneously for the same user action
2. **Low Detection Threshold**: 1500ms minimum hidden time was too sensitive for legitimate browser behaviors
3. **No Event Deduplication**: Multiple events could trigger the same penalty within seconds
4. **Mobile Browser Issues**: Mobile browsers have unpredictable behavior with blur/focus events
5. **Browser UI Interactions**: Developer tools, address bar focus, browser extensions, zoom operations were triggering false positives

## Fixes Implemented

### Client-Side Changes (common.js)
1. **Increased Detection Threshold**: From 1500ms to 3000ms minimum hidden time
2. **Added Event Validation**: New `validateLegitimateTabSwitch()` function to filter false positives
3. **Rapid Change Detection**: Tracks consecutive visibility changes to ignore browser glitches
4. **Mobile Device Handling**: Special handling for mobile browsers to ignore unreliable blur events
5. **Improved Event Hierarchy**: 
   - Primary: `visibilitychange` (most reliable)
   - Secondary: `pagehide/pageshow` (backup for older browsers)
   - Tertiary: `blur/focus` (desktop only, with 500ms delay filter)
6. **Extended Cooldown**: Increased cooldown period from 3 to 5 seconds between detections

### Server-Side Changes (escape.js)
1. **Consistent Threshold**: Updated server validation to match 3000ms minimum
2. **Rapid Detection Prevention**: 10-second minimum between consecutive penalties
3. **System Sleep Detection**: Ignore very long hidden periods (>5 minutes) as system hibernation
4. **Enhanced Logging**: Better tracking of ignored events for debugging

## Expected Results
- Significant reduction in false positive tab switch detections
- More accurate detection of legitimate tab switches
- Better user experience with fewer unfair penalties
- Improved reliability across different browsers and devices

## Testing Recommendations
1. Test across different browsers (Chrome, Firefox, Edge, Safari)
2. Test on mobile devices (Android, iOS)
3. Test legitimate scenarios that previously caused false positives:
   - Opening developer tools (F12)
   - Browser zoom operations (Ctrl+/-)
   - Address bar focus (Ctrl+L)
   - System notifications
   - Brief app switching on mobile
4. Verify actual tab switches are still detected correctly

## Monitoring
- Monitor penalty logs for patterns of ignored events
- Track user complaints about false positives
- Review console logs for detection patterns
- Consider A/B testing if further adjustments needed

## Rollback Plan
If issues arise, revert the threshold changes:
- Change `ESCAPE_MIN_HIDDEN_MS_FOR_PENALTY` back to 1500 in common.js
- Change server validation threshold back to 1500 in escape.js
- Remove the rapid detection prevention in server-side code