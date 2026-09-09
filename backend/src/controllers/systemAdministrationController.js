const pool = require('../config/database');
const { createSystemAccountSecurityService } = require('../services/systemAccountSecurityService');
const { recordSecurityEvent } = require('../services/securityEventService');
const { assertAllowedFields } = require('../utils/validators');
const accountSecurity=createSystemAccountSecurityService({pool});

const boundedLimit = (value) => Math.min(Math.max(Number.parseInt(value, 10) || 25, 1), 100);

const status = async (_req, res) => {
    const checkedAt = new Date().toISOString();
    try {
        await pool.query('SELECT 1 AS healthy');
        return res.json({
            success: true,
            system: {
                status: 'OPERATIONAL',
                application: 'STI Vio-Log',
                version: process.env.APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'Not published',
                environment: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
                database: 'CONNECTED',
                integrations: {
                    google_identity: process.env.GOOGLE_CLIENT_ID ? 'CONFIGURED' : 'NOT_CONFIGURED',
                    email_delivery: process.env.BREVO_API_KEY || process.env.SMTP_HOST ? 'CONFIGURED' : 'NOT_CONFIGURED'
                },
                checked_at: checkedAt
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
        const result = await pool.query(
            `SELECT id,actor_user_id,actor_readable_name,actor_role,effective_permissions,action,target_type,target_id,target_label,
                    safe_details,reason,occurred_at,ip_address,user_agent,request_id,result,support_access_request_id
             FROM administrative_security_events ORDER BY occurred_at DESC,id DESC LIMIT $1`,
            [limit]
        );
        return res.json({ success:true, events:result.rows });
    } catch (_error) {
        return res.status(500).json({ success:false, error:{ code:'SECURITY_EVENTS_UNAVAILABLE', message:'Security events are temporarily unavailable' } });
    }
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

const accountLock = async (req,res) => {
    try {
        assertAllowedFields(req.body || {},['reason']);
        const account=await accountSecurity.lock({actorId:req.user.id,targetId:req.params.id,reason:req.body?.reason});
        await recordSecurityEvent({actor:req.user,action:'ACCOUNT_LOCK',targetType:'USER_ACCOUNT',targetId:account.id,targetLabel:account.username,reason:req.body.reason,result:'SUCCESS',ipAddress:req.ip,userAgent:req.get('user-agent'),requestId:req.requestId});
        return res.json({success:true,message:'Account locked and active sessions invalidated.',account});
    } catch(error){
        await recordSecurityEvent({actor:req.user,action:'ACCOUNT_LOCK',targetType:'USER_ACCOUNT',targetId:req.params.id,reason:req.body?.reason,result:'FAILED',details:{error_code:error.code||'INTERNAL_ERROR'},ipAddress:req.ip,userAgent:req.get('user-agent'),requestId:req.requestId});
        return res.status(error.statusCode||500).json({success:false,error:{code:error.code||'ACCOUNT_LOCK_FAILED',message:error.statusCode?error.message:'Account lock failed'}});
    }
};

const accountRecovery = async (req,res) => {
    try {
        assertAllowedFields(req.body || {},['reason']);
        const recovery=await accountSecurity.initiateRecovery({actorId:req.user.id,targetId:req.params.id,reason:req.body?.reason});
        await recordSecurityEvent({actor:req.user,action:'ACCOUNT_RECOVERY_INITIATED',targetType:'USER_ACCOUNT',targetId:recovery.account.id,targetLabel:recovery.account.username,reason:req.body.reason,result:'SUCCESS',ipAddress:req.ip,userAgent:req.get('user-agent'),requestId:req.requestId});
        return res.json({success:true,message:'Temporary credential created. It will be displayed only in this response.',recovery});
    } catch(error){
        await recordSecurityEvent({actor:req.user,action:'ACCOUNT_RECOVERY_INITIATED',targetType:'USER_ACCOUNT',targetId:req.params.id,reason:req.body?.reason,result:'FAILED',details:{error_code:error.code||'INTERNAL_ERROR'},ipAddress:req.ip,userAgent:req.get('user-agent'),requestId:req.requestId});
        return res.status(error.statusCode||500).json({success:false,error:{code:error.code||'ACCOUNT_RECOVERY_FAILED',message:error.statusCode?error.message:'Account recovery failed'}});
    }
};

module.exports = { status, securityEvents, authenticationActivity, accountLock, accountRecovery };
