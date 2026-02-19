// Tab Switch Detection Test Utility
// Use this in browser console to test ultra-strict detection

function testTabSwitchDetection() {
  console.log('=== TAB SWITCH DETECTION TEST ===');
  
  // Check if detection is enabled
  if (!window.ER || !window.ER.getTabSwitchDebugInfo) {
    console.error('❌ Tab switch detection not loaded!');
    return;
  }
  
  const debugInfo = window.ER.getTabSwitchDebugInfo();
  console.log('📊 Current Detection State:', debugInfo);
  
  // Test ultra-strict threshold
  console.log('⚡ ULTRA-STRICT MODE:');
  console.log('   - Threshold:', debugInfo.thresholdMs + 'ms (should be 300ms)');
  console.log('   - Cooldown active:', debugInfo.cooldownActive);
  console.log('   - Currently hidden:', debugInfo.currentlyHidden);
  
  // Device-specific info
  console.log('📱 Device Info:', debugInfo.browserInfo);
  
  // Instructions
  console.log('\n🧪 TEST INSTRUCTIONS:');
  console.log('1. Switch tabs and return IMMEDIATELY (fraction of second)');
  console.log('2. Console should show detection within 300-500ms');
  console.log('3. Alert should appear if detection successful');
  console.log('4. Test on all levels (1-5) to ensure consistency');
  
  // Monitor for changes
  let lastDetectionCount = debugInfo.detectionState.detectionCount;
  const monitor = setInterval(() => {
    const currentInfo = window.ER.getTabSwitchDebugInfo();
    if (currentInfo.detectionState.detectionCount > lastDetectionCount) {
      console.log('✅ TAB SWITCH DETECTED! Count:', currentInfo.detectionState.detectionCount);
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