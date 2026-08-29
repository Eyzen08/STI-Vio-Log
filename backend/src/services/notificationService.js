const insertNotification = async (client, { userId, title, message, type, eventKey }) => {
  if (!client?.query || !userId || !title || !message || !eventKey) return null;
  return (await client.query(
    `INSERT INTO notifications (user_id, title, message, notification_type, event_key)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING
     RETURNING id`,
    [userId, title, message, type || null, eventKey]
  )).rows[0] || null;
};

const notifyStudent = async (client, studentId, notification) => {
  const student = (await client.query('SELECT user_id FROM students WHERE id = $1', [studentId])).rows[0];
  return student ? insertNotification(client, { ...notification, userId: student.user_id }) : null;
};

module.exports = { insertNotification, notifyStudent };
