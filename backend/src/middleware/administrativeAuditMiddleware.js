const { recordSecurityEvent } = require('../services/securityEventService');

const AUDITED_ROLES=new Set(['SYSTEM_ADMIN','DISCIPLINE_ADMIN','DISCIPLINE_OFFICE']);
const classifyAdministrativeRequest=({method='',baseUrl='',path='',originalUrl=''})=>{
  const verb=String(method).toUpperCase();
  const route=`${baseUrl}${path || ''}`.split('?')[0] || String(originalUrl).split('?')[0];
  const mutation=!['GET','HEAD','OPTIONS'].includes(verb);
  if(route.startsWith('/api/parent-contact/'))return{action:mutation?'GUARDIAN_CONTACT_UPDATE':'GUARDIAN_CONTACT_VIEW',targetType:'STUDENT_GUARDIAN'};
  if(route.startsWith('/api/messages/'))return{action:mutation?'PRIVATE_MESSAGE_ACTION':'PRIVATE_MESSAGES_VIEW',targetType:'CONVERSATION'};
  if(route.startsWith('/api/violations')&&mutation)return{action:'VIOLATION_ADMIN_ACTION',targetType:'VIOLATION'};
  if(route.startsWith('/api/community-service')&&mutation)return{action:'COMMUNITY_SERVICE_ADMIN_ACTION',targetType:'COMMUNITY_SERVICE'};
  if(route.startsWith('/api/qr')&&mutation)return{action:'ATTENDANCE_ADMIN_ACTION',targetType:'ATTENDANCE'};
  if(route.startsWith('/api/clearance')&&mutation)return{action:route.includes('/signatures')?'ESIGNATURE_ADMIN_ACTION':route.includes('/certificates')?'CERTIFICATE_ADMIN_ACTION':'CLEARANCE_ADMIN_ACTION',targetType:'CLEARANCE'};
  if((route.startsWith('/api/admin/accounts')||route.startsWith('/api/department-accounts'))&&mutation)return{action:'STAFF_ACCOUNT_ADMIN_ACTION',targetType:'USER_ACCOUNT'};
  if(route.startsWith('/api/admin/departments')&&mutation)return{action:'DEPARTMENT_ADMIN_ACTION',targetType:'DEPARTMENT'};
  if(route.startsWith('/api/admin/officer-responsibilities')&&mutation)return{action:'OFFICER_ASSIGNMENT_ADMIN_ACTION',targetType:'OFFICER_ASSIGNMENT'};
  if(route.endsWith('.csv'))return{action:'SENSITIVE_DATA_EXPORT',targetType:'REPORT'};
  return null;
};

const auditAdministrativeRequest=(req,res,next)=>{
  const classification=classifyAdministrativeRequest(req);
  if(!classification||!AUDITED_ROLES.has(req.user?.role))return next();
  res.once('finish',()=>{
    const result=res.statusCode===401||res.statusCode===403?'DENIED':res.statusCode>=400?'FAILED':'SUCCESS';
    void recordSecurityEvent({actor:req.user,action:classification.action,targetType:classification.targetType,targetId:req.params?.id||req.params?.studentId,targetLabel:`${req.method} ${(req.baseUrl||'')+(req.path||'')}`,details:{http_status:res.statusCode},result,ipAddress:req.ip,userAgent:req.get?.('user-agent'),requestId:req.requestId,supportAccessRequestId:req.user.support_access_request_id});
  });
  return next();
};

module.exports={AUDITED_ROLES,classifyAdministrativeRequest,auditAdministrativeRequest};
