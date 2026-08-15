const pool = require('./src/config/database');

async function seedTestData() {
  try {
    // Create test student linked to student1 user
    const studentResult = await pool.query(
      `INSERT INTO students (user_id, student_number, first_name, last_name, program, year_level, section, qr_code)
       VALUES (2, '2024-001', 'Maria', 'Santos', 'BSIT', 3, 'BSIT-3A', 'STI-2024-001')
       ON CONFLICT DO NOTHING
       RETURNING id`
    );

    let studentId = 1;
    if (studentResult.rows.length > 0) {
      studentId = studentResult.rows[0].id;
      console.log(`✓ Created student: Maria Santos (Student ID: ${studentId})`);
    } else {
      console.log(`- Using existing student ID: ${studentId}`);
    }

    // Seed violation type if not exists
    const violationTypeResult = await pool.query(
      `INSERT INTO violation_types (violation_code, violation_name, severity)
       VALUES ('LATE', 'Late to Class', 'MINOR')
       ON CONFLICT DO NOTHING
       RETURNING id`
    );

    let violationTypeId = 1;
    if (violationTypeResult.rows.length > 0) {
      violationTypeId = violationTypeResult.rows[0].id;
      console.log(`✓ Created violation type: LATE`);
    } else {
      console.log(`- Using existing violation type ID: ${violationTypeId}`);
    }

    // Create a test violation
    const violationResult = await pool.query(
      `INSERT INTO violations (student_id, violation_type_id, incident_date, description, status, required_service_hours)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING
       RETURNING id, status`,
      [studentId, violationTypeId, '2026-08-10', 'Student was 15 minutes late to class', 'OPEN', 8]
    );

    if (violationResult.rows.length > 0) {
      console.log(`✓ Created violation record (ID: ${violationResult.rows[0].id}, Status: ${violationResult.rows[0].status})`);
    } else {
      console.log(`- Violation record already exists`);
    }

    console.log('\n✅ Test data seeded successfully');
    console.log('\nYou can now login as:');
    console.log('- Admin: admin / password');
    console.log('- Student: student1 / student123 (will see 1 violation)');
    console.log('- Dept Head: depthead1 / dept123 (QR scanning interface)');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

seedTestData();
