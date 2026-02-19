// Quick penalty system test
// Run this in browser console to test penalty application

async function quickPenaltyTest() {
  // Set up test team ID
  const testTeamId = 'TEST-TEAM-001';
  sessionStorage.setItem('teamId', testTeamId);
  
  console.log('🧪 Starting penalty system test...');
  console.log('Team ID:', testTeamId);
  
  // Test server connection first
  try {
    const response = await fetch('/api/escape/tab-switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: testTeamId, hiddenMs: 1000 })
    });
    
    const data = await response.json();
    console.log('Server response:', data);
    
    if (data.error) {
      console.error('❌ Server error:', data.error);
      if (data.error === 'Team not found') {
        console.log('💡 Creating test team...');
        // Create a test team
        const createResponse = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: testTeamId,
            teamName: 'Test Team',
            email: 'test@example.com',
            leaderName: 'Test Leader',
            member2Name: 'Test Member 2',
            member3Name: 'Test Member 3',
            contactNo: '1234567890'
          })
        });
        
        const createData = await createResponse.json();
        console.log('Team creation result:', createData);
        
        if (createData.success) {
          console.log('✅ Test team created, retrying penalty test...');
          return quickPenaltyTest(); // Retry the test
        }
      }
    } else {
      console.log('✅ Penalty system test completed successfully!');
      console.log('Action:', data.action);
      console.log('Score deducted:', data.scoreDeducted);
      console.log('Current score:', data.currentScore);
      console.log('Tab switch count:', data.tabSwitchCount);
      
      // Show the actual alert that users would see
      const penaltyMessage = data.message ||
        ('TAB SWITCH PENALTY APPLIED!\n\n' +
         '❌ Score Deducted: -' + (data.scoreDeducted || 10) + ' marks\n' +
         '📊 Current Score: ' + (data.currentScore || 0) + '\n' +
         '🔢 Total Violations: ' + (data.tabSwitchCount || 1) + '\n\n' +
         '⚠️ Stay focused on the exam!');
      
      alert(penaltyMessage);
    }
  } catch (err) {
    console.error('❌ Network error:', err);
  }
}

// Auto-run the test
quickPenaltyTest();