const bcrypt = require('bcrypt');
const pool = require('./src/config/database');

async function seedTestUsers() {
  try {
    const testUsers = [
      { username: 'student1', password: 'student123', role: 'STUDENT' },
      { username: 'depthead1', password: 'dept123', role: 'DEPARTMENT_HEAD' }
    ];

    for (const user of testUsers) {
      const hash = await bcrypt.hash(user.password, 10);
      const result = await pool.query(
        'INSERT INTO users (username, password_hash, role, is_active) VALUES ($1, $2, $3, TRUE) ON CONFLICT DO NOTHING RETURNING id, username, role',
        [user.username, hash, user.role]
      );
      if (result.rows.length > 0) {
        console.log(`✓ Created: ${result.rows[0].username} (${result.rows[0].role})`);
      } else {
        console.log(`- Skipped (exists): ${user.username}`);
      }
    }

    console.log('\nTest credentials:');
    console.log('Student: student1 / student123 (STUDENT role)');
    console.log('Dept Head: depthead1 / dept123 (DEPARTMENT_HEAD role)');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

seedTestUsers();
