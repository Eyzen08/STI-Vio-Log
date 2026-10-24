const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { testDatabaseConfig } = require('./testDatabase');
const { runMigrations } = require('../scripts/migrate');
const runtime = require('../src/config/database');
const realtime = require('../src/realtime');
const events=[];
const emitToUser=realtime.emitToUser;
const emitToRole=realtime.emitToRole;
realtime.emitToUser=(userId,event)=>events.push({userId,event});
realtime.emitToRole=(role,event)=>events.push({role,event});
const messages = require('../src/controllers/messageController');
realtime.emitToUser=emitToUser;
realtime.emitToRole=emitToRole;

test('conversation preferences are private, preserve unread state, and return on replies', async () => {
  const schema = `sti_vio_log_test_message_preferences_${process.pid}_${Date.now()}`;
  const admin = new Pool(testDatabaseConfig());
  let database;
  const originalQuery = runtime.query;
  const originalConnect = runtime.connect;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    database = new Pool(testDatabaseConfig(schema));
    await runMigrations(database, { logger: { log() {} } });
    await database.query(`INSERT INTO users(username,password_hash,role) VALUES
      ('office','hash','DISCIPLINE_ADMIN'),('officer','hash','DISCIPLINE_OFFICE'),
      ('student','hash','STUDENT'),('other','hash','STUDENT');
      INSERT INTO students(user_id,student_number,first_name,last_name,qr_code) VALUES
      (3,'TEST-1','Test','Student','QR-1'),(4,'TEST-2','Other','Student','QR-2');
      INSERT INTO message_conversations(student_id,subject,created_by_user_id) VALUES
      (1,'First thread',3),(1,'Second thread',3);
      INSERT INTO conversation_messages(conversation_id,sender_user_id,message_text,created_at) VALUES
      (1,3,'First message',CURRENT_TIMESTAMP - INTERVAL '2 minutes'),
      (2,3,'Second message',CURRENT_TIMESTAMP - INTERVAL '1 minute');`);
    runtime.query = (...args) => database.query(...args);
    runtime.connect = (...args) => database.connect(...args);
    const office = { id: 1, role: 'DISCIPLINE_ADMIN' };
    const officer = { id: 2, role: 'DISCIPLINE_OFFICE' };
    const student = { id: 3, role: 'STUDENT' };
    const call = async (handler, user, { id = '1', body = {}, query = {} } = {}) => {
      const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
      await handler({ user, params: { id }, body, query }, response);
      assert.equal(response.statusCode < 500, true, JSON.stringify(response.body));
      return response;
    };
    assert.equal((await call(messages.getUnreadCount, office)).body.unread_total, 2);
    assert.equal((await call(messages.updateConversationPreferences, office, { body: { is_pinned: true } })).statusCode, 200);
    assert.deepEqual(events.splice(0),[{userId:1,event:'messages:changed'}]);
    let list = (await call(messages.listConversations, office)).body;
    assert.deepEqual(list.conversations.map(row => Number(row.id)), [1, 2]);
    assert.equal(list.conversations[0].unread_count, 1, 'pinning must not mark messages read');
    assert.equal((await call(messages.listConversations, officer)).body.conversations.find(row => Number(row.id) === 1).is_pinned, false);
    assert.equal((await call(messages.markConversationRead, office)).statusCode, 200, 'legacy empty read body');
    assert.deepEqual(events.splice(0),[{userId:1,event:'messages:changed'}]);
    const watermark=(await database.query('SELECT last_read_at FROM conversation_reads WHERE conversation_id=1 AND user_id=1')).rows[0].last_read_at;
    await call(messages.updateConversationPreferences, office, { body: { is_pinned: false } });
    assert.deepEqual((await database.query('SELECT last_read_at FROM conversation_reads WHERE conversation_id=1 AND user_id=1')).rows[0].last_read_at,watermark);
    assert.equal((await call(messages.getUnreadCount, office)).body.unread_total, 1);
    await call(messages.markConversationRead, office, { body: { is_read: false } });
    list = (await call(messages.listConversations, office, { query: { unread: 'true', limit: '1', page: '2' } })).body;
    assert.equal(list.pagination.total, 2);
    assert.equal(list.conversations.length, 1);
    assert.equal(list.unread_total, 2);
    assert.equal((await call(messages.listConversations, office, { query: { search: 'missing' } })).body.unread_total, 2, 'search must not reset global badge');
    await call(messages.updateConversationPreferences, office, { body: { is_archived: true } });
    assert.equal((await call(messages.listConversations, office)).body.pagination.total, 1);
    assert.equal((await call(messages.getUnreadCount, office)).body.unread_total, 1);
    assert.equal((await call(messages.listConversations, office, { query: { folder: 'ARCHIVED' } })).body.conversations[0].is_archived, true);
    await call(messages.sendMessage, student, { body: { message: 'Reply to archived thread' } });
    assert.equal((await call(messages.listConversations, office, { query: { folder: 'ARCHIVED' } })).body.pagination.total,0);
    assert.equal((await call(messages.listConversations, office)).body.pagination.total,2);
    events.length=0;
    await call(messages.deleteConversation, office);
    assert.deepEqual(events.splice(0),[{userId:1,event:'messages:changed'}]);
    assert.equal((await call(messages.getConversation, office)).statusCode, 404);
    assert.equal((await call(messages.getConversation, officer)).statusCode, 200);
    assert.equal((await call(messages.getConversation, { id: 4, role: 'STUDENT' })).statusCode, 404);
    assert.equal(Number((await database.query('SELECT COUNT(*) AS count FROM conversation_messages')).rows[0].count), 3);
    const sent = await call(messages.sendMessage, student, { body: { message: 'A new reply' } });
    assert.equal(sent.statusCode, 201);
    assert.equal((await call(messages.getConversation, office)).statusCode, 200);
    assert.equal((await call(messages.listConversations, office)).body.pagination.total, 2);
    assert.equal((await call(messages.updateConversationPreferences, office, { body: { is_pinned: 'true' } })).statusCode, 400);
    assert.equal((await call(messages.updateConversationPreferences, office, { body: { user_id: 2, is_pinned: true } })).statusCode, 400);
    assert.equal((await call(messages.markConversationRead, office, { body: { is_read: 'false' } })).statusCode, 400);
    assert.equal((await call(messages.markConversationRead, office, { body: { is_read: null } })).statusCode, 400);
    assert.equal((await call(messages.updateConversationPreferences,office,{body:null})).statusCode,400);
    assert.equal((await call(messages.markConversationRead,office,{body:[]})).statusCode,400);

    // A send transaction started earlier must not backdate a later incoming reply.
    let resumeSend;
    let signalStarted;
    const started=new Promise(resolve=>{signalStarted=resolve});
    const resume=new Promise(resolve=>{resumeSend=resolve});
    let pauseNext=true;
    runtime.connect=async()=>{
      const client=await database.connect();
      return {release:()=>client.release(),query:async(...args)=>{
        const result=await client.query(...args);
        if(args[0]==='BEGIN'&&pauseNext){pauseNext=false;signalStarted();await resume}
        return result;
      }};
    };
    const concurrentSend=call(messages.sendMessage,student,{body:{message:'Concurrent reply'}});
    await started;
    try{await call(messages.markConversationRead,office)}finally{resumeSend()}
    await concurrentSend;
    runtime.connect=(...args)=>database.connect(...args);
    assert.equal((await call(messages.getConversation,office)).body.conversation.unread_count,1);
    assert.equal((await call(messages.updateConversationStatus, student, { body: { status: 'CLOSED' } })).statusCode, 403);
    await call(messages.updateConversationStatus, office, { body: { status: 'CLOSED' } });
    assert.equal((await call(messages.sendMessage, student, { body: { message: 'Cannot reply' } })).statusCode, 409);
  } finally {
    runtime.query = originalQuery;
    runtime.connect = originalConnect;
    if (database) await database.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
    await runtime.end();
  }
});
