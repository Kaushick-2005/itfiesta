// Tab Switch Detection Test Utility
// Use this in browser console to test balanced strict detection

function testTabSwitchDetection() {
  console.log('=== TAB SWITCH DETECTION TEST ===');
  
  // Check if detection is enabled
  if (!window.ER || !window.ER.getTabSwitchDebugInfo) {
    console.error('❌ Tab switch detection not loaded!');
    return;
  }
  
  const debugInfo = window.ER.getTabSwitchDebugInfo();
  console.log('📊 Current Detection State:', debugInfo);
  
  // Test balanced strict threshold
  console.log('⚡ BALANCED STRICT MODE:');
  console.log('   - Threshold:', debugInfo.thresholdMs + 'ms (should be 500ms)');
  console.log('   - Cooldown active:', debugInfo.cooldownActive);
  console.log('   - Currently hidden:', debugInfo.currentlyHidden);
  
  // Device-specific info
  console.log('📱 Device Info:', debugInfo.browserInfo);
  
  // Instructions
  console.log('\n🧪 PENALTY TEST INSTRUCTIONS:');
  console.log('1. Switch tabs and return within 0.5-1 seconds');
  console.log('2. First alert: "Processing penalty..." (immediate)');
  console.log('3. Second alert: Actual penalty details with score (after 1.5s)');
  console.log('4. Check console logs for server communication');
  console.log('5. Verify score deduction in database/UI');
  
  // Monitor for changes
  let lastDetectionCount = debugInfo.detectionState.detectionCount;
  const monitor = setInterval(() => {
    const currentInfo = window.ER.getTabSwitchDebugInfo();
    if (currentInfo.detectionState.detectionCount > lastDetectionCount) {
      console.log('✅ TAB SWITCH DETECTED! Count:', currentInfo.detectionState.detectionCount);
      console.log('⏱️ Detection was IMMEDIATE as expected');
      lastDetectionCount = currentInfo.detectionState.detectionCount;
    }
  }, 100);
  
  // Stop monitoring after 30 seconds
  setTimeout(() => {
    clearInterval(monitor);
    console.log('⏰ Test monitoring stopped');
  }, 30000);
}

// Auto-test when page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (window.location.pathname.includes('/levels/')) {
      console.log('🚀 Tab Switch Detection Test Ready');
      console.log('💡 Type testTabSwitchDetection() to start testing');
    }
  }, 2000);
});

// Export for console use
window.testTabSwitchDetection = testTabSwitchDetection;

// Manual penalty test function
window.testPenaltyApplication = function() {
  console.log('🧪 Testing penalty application manually...');
  
  if (window.ER && window.ER.testPenalty) {
    window.ER.testPenalty(750); // Simulate 750ms tab switch
  } else {
    console.error('❌ Penalty test function not available');
    console.log('Available ER functions:', window.ER ? Object.keys(window.ER) : 'ER object not found');
  }
};