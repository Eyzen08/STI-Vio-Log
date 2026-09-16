const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const sessions=require('../src/services/browserSessionService');
const totp=require('../src/services/totpService');
const {requireCsrf}=require('../src/middleware/authMiddleware');
const authRoutes=require('../src/routes/authRoutes');

test('opaque sessions persist hashes and set hardened cookies',async()=>{
 const calls=[];const database={async query(sql,params=[]){calls.push({sql:String(sql),params});if(String(sql).startsWith('SELECT role'))return{rows:[{role:'DISCIPLINE_ADMIN'}]};return{rows:[{absolute_expires_at:new Date(Date.now()+1000)}]}}};
 const created=await sessions.createSession({userId:9,ipAddress:'127.0.0.1',userAgent:'test',database});
 assert.equal(calls.some(call=>call.params.includes(created.token)||call.params.includes(created.csrf)),false);
 const headers=[];sessions.setSessionCookies({append(_name,value){headers.push(value)}},created);
 assert.match(headers[0],/HttpOnly/);assert.match(headers[0],/SameSite=Lax/);assert.doesNotMatch(headers[1],/HttpOnly/);
});

test('CSRF requires matching cookie, header, and session-bound hash',()=>{
 process.env.CSRF_SIGNING_KEY='c'.repeat(48);const raw='csrf-value';
 const req={method:'POST',headers:{cookie:`sti_csrf=${raw}`},session:{csrfHash:sessions.hash(raw,process.env.CSRF_SIGNING_KEY)},get:name=>name==='x-csrf-token'?raw:null};
 const res={statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};let called=false;
 requireCsrf(req,res,()=>{called=true});assert.equal(called,true);
 req.get=()=>null;called=false;requireCsrf(req,res,()=>{called=true});assert.equal(called,false);assert.equal(res.body.error.code,'CSRF_INVALID');
});

test('TOTP secrets are encrypted with AES-GCM and accept only a narrow time window',()=>{
 process.env.MFA_ENCRYPTION_KEY=crypto.randomBytes(32).toString('base64');const secret=totp.generateSecret(),now=Date.now(),code=totp.codeAt(secret,now),encrypted=totp.encrypt(secret);
 assert.notEqual(encrypted,secret);assert.equal(totp.decrypt(encrypted),secret);assert.equal(totp.verifyCode(secret,code,now),true);assert.equal(totp.verifyCode(secret,'000000',now),code==='000000');
});

test('authentication routes expose session and MFA lifecycle endpoints',()=>{
 const routes=authRoutes.stack.filter(layer=>layer.route).map(layer=>`${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
 for(const expected of ['GET /auth/session','GET /auth/csrf','POST /auth/logout','POST /auth/mfa/setup/start','POST /auth/mfa/setup/confirm','POST /auth/mfa/verify','POST /auth/mfa/recovery'])assert(routes.includes(expected));
});
