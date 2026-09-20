const pool = require('../config/database');

const boundedLimit = (value) => Math.min(Math.max(Number.parseInt(value, 10) || 25, 1), 100);

const status = async (_req, res) => {
    const checkedAt = new Date().toISOString();
    const started=process.hrtime.bigint();
    try {
        await pool.query('SELECT 1 AS healthy');
        const databaseLatencyMs=Number(process.hrtime.bigint()-started)/1e6;
        const failures=await pool.query(`SELECT action,result,occurred_at FROM administrative_security_events WHERE result IN ('FAILED','DENIED') ORDER BY occurred_at DESC LIMIT 5`);
        const components={
          api:{status:'OPERATIONAL',remediation:null},
          database:{status:databaseLatencyMs>750?'DEGRADED':'OPERATIONAL',latency_ms:Math.round(databaseLatencyMs),remediation:databaseLatencyMs>750?'Check database load and regional connectivity.':null},
          google_identity:{status:process.env.GOOGLE_CLIENT_ID?'CONFIGURED':'NOT_CONFIGURED',remediation:process.env.GOOGLE_CLIENT_ID?null:'Configure the Google OAuth client ID before enabling Google sign-in.'},
          email_delivery:{status:(process.env.BREVO_API_KEY||process.env.SMTP_HOST)?'CONFIGURED':'NOT_CONFIGURED',remediation:(process.env.BREVO_API_KEY||process.env.SMTP_HOST)?null:'Configure an email provider before relying on verification or recovery email.'},
          realtime:{status:'AVAILABLE',remediation:null}
        };
        const degraded=Object.values(components).some((item)=>['DEGRADED','UNAVAILABLE'].includes(item.status));
        return res.json({
            success: true,
            system: {
                status: degraded?'DEGRADED':'OPERATIONAL',
                application: 'STI Vio-Log',
                version: process.env.APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'Not published',
                environment: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
                database: 'CONNECTED',
                integrations: {
                    google_identity: process.env.GOOGLE_CLIENT_ID ? 'CONFIGURED' : 'NOT_CONFIGURED',
                    email_delivery: process.env.BREVO_API_KEY || process.env.SMTP_HOST ? 'CONFIGURED' : 'NOT_CONFIGURED'
                },
                checked_at: checkedAt,
                components,
                recent_failures:failures.rows
            }
        });
    } catch (error) {
        console.error('[SYSTEM_STATUS] Database connectivity check failed');
        return res.status(503).json({
            success: false,
            system: { status: 'DEGRADED', database: 'UNAVAILABLE', checked_at: checkedAt },
            error: { code: 'SYSTEM_DEGRADED', message: 'A required service is unavailable' }
        });
    }
};

const securityEvents = async (req, res) => {
    try {
        const limit = boundedLimit(req.query.limit);
        const page=Math.max(Number.parseInt(req.query.page,10)||1,1);
        const clauses=[];const params=[];
        const add=(sql,value)=>{params.push(value);clauses.push(sql.replace('?',`$${params.length}`))};
        if(req.query.search)add(`(action ILIKE ? OR target_label ILIKE ? OR actor_readable_name ILIKE ?)`,`%${String(req.query.search).slice(0,100)}%`);
        if(req.query.search){const value=params.pop();clauses.pop();params.push(value,value,value);clauses.push(`(action ILIKE $${params.length-2} OR target_label ILIKE $${params.length-1} OR actor_readable_name ILIKE $${params.length})`)}
        if(req.query.result)add('result=?',String(req.query.result).slice(0,30));
        if(req.query.from)add('occurred_at>=?',req.query.from);
        if(req.query.to)add('occurred_at<=?',req.query.to);
        params.push(limit,(page-1)*limit);
        const result = await pool.query(
            `SELECT id,actor_user_id,actor_readable_name,actor_role,effective_permissions,action,target_type,target_id,target_label,
                    safe_details,reason,occurred_at,ip_address,user_agent,request_id,result,support_access_request_id
             FROM administrative_security_events ${clauses.length?`WHERE ${clauses.join(' AND ')}`:''} ORDER BY occurred_at DESC,id DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
            params
        );
        return res.json({ success:true, events:result.rows, pagination:{page,limit,has_more:result.rows.length===limit} });
    } catch (_error) {
        return res.status(500).json({ success:false, error:{ code:'SECURITY_EVENTS_UNAVAILABLE', message:'Security events are temporarily unavailable' } });
    }
};

const accountDirectory=async(req,res)=>{
  try{const search=String(req.query.search||'').trim().slice(0,100);const limit=Math.min(Math.max(Number(req.query.limit)||20,1),50);const value=`%${search}%`;
    const result=await pool.query(`SELECT u.id,u.username,u.role,u.is_active,COALESCE(sp.first_name,dh.first_name,s.first_name) first_name,
      COALESCE(sp.last_name,dh.last_name,s.last_name) last_name,COALESCE(d.department_name,'No department') department_name
      FROM users u LEFT JOIN staff_profiles sp ON sp.user_id=u.id LEFT JOIN department_heads dh ON dh.user_id=u.id
      LEFT JOIN students s ON s.user_id=u.id LEFT JOIN departments d ON d.id=COALESCE(sp.department_id,dh.department_id)
      WHERE ($1='' OR u.username ILIKE $2 OR COALESCE(sp.first_name,dh.first_name,s.first_name,'') ILIKE $2 OR COALESCE(sp.last_name,dh.last_name,s.last_name,'') ILIKE $2)
      ORDER BY u.is_active DESC,u.username LIMIT $3`,[search,value,limit]);return res.json({success:true,accounts:result.rows});
  }catch(_error){return res.status(500).json({success:false,error:{code:'ACCOUNT_DIRECTORY_UNAVAILABLE',message:'Account directory is temporarily unavailable'}})}
};

const authenticationActivity = async (req, res) => {
    try {
        const limit = boundedLimit(req.query.limit);
        const result = await pool.query(
            `SELECT id,actor_user_id,actor_readable_name,actor_role,action,target_label,safe_details,occurred_at,ip_address,user_agent,request_id,result
             FROM administrative_security_events
             WHERE action LIKE 'AUTH_%' OR action LIKE 'LOGIN_%' OR action LIKE 'ACCOUNT_PASSWORD_%'
             ORDER BY occurred_at DESC,id DESC LIMIT $1`,
            [limit]
        );
        return res.json({ success:true, activity:result.rows });
    } catch (_error) {
        return res.status(500).json({ success:false, error:{ code:'AUTH_ACTIVITY_UNAVAILABLE', message:'Authentication activity is temporarily unavailable' } });
    }
};

module.exports = { status, securityEvents, authenticationActivity, accountDirectory };
