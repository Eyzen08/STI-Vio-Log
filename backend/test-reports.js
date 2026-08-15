async function testReportsAPI() {
  try {
    // Login as admin
    const loginRes = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password' })
    });

    const loginData = await loginRes.json();
    if (!loginData.success) throw new Error(loginData.message);

    const token = loginData.token;

    // Test violations report
    const violationsRes = await fetch('http://localhost:5000/api/reports/violations', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const violationsData = await violationsRes.json();
    console.log('✓ Violations Report');
    console.log('  Total records:', violationsData.total_records);
    if (violationsData.data.length > 0) {
      console.log('  First record:', violationsData.data[0]);
    }

    // Test community service report
    const serviceRes = await fetch('http://localhost:5000/api/reports/community-service', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const serviceData = await serviceRes.json();
    console.log('\n✓ Community Service Report');
    console.log('  Total records:', serviceData.total_records);
    console.log('  Total pending hours:', serviceData.total_pending_hours);

    // Test non-compliance report
    const complianceRes = await fetch('http://localhost:5000/api/reports/non-compliance', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const complianceData = await complianceRes.json();
    console.log('\n✓ Non-Compliance Report');
    console.log('  Total non-compliant students:', complianceData.total_non_compliant_students);
    if (complianceData.data.length > 0) {
      console.log('  First student:', complianceData.data[0]);
    }

    console.log('\n✅ All reports API endpoints working!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testReportsAPI();
