const rateLimit = require('express-rate-limit');

const message = { success:false, message:'Too many requests. Please wait before trying again.', error:{code:'RATE_LIMITED',message:'Too many requests. Please wait before trying again.'} };
const options = { windowMs:15*60*1000, standardHeaders:true, legacyHeaders:false, message };
const publicAndWrite = rateLimit({...options,max:200});
const failedAccess = rateLimit({...options,max:200,skipSuccessfulRequests:true,
  requestWasSuccessful:(_req,res) => res.statusCode < 400 || res.statusCode >= 500 || res.statusCode === 429});
const accountReads = rateLimit({...options,max:600,keyGenerator:req => `account:${req.user.id}`});

// Only mounted authenticated reads can leave the public IP budget. Cookie contents never select a budget.
const protectedRead = req => ['GET','HEAD'].includes(req.method) && (
  /^\/api\/(?:students|violations|community-service|qr|clearance|student|reports|audit-logs|parent-contact|google-registrations|account|system|high-risk-actions|admin|department-accounts|department-heads|messages|notifications|avatars|officer-responsibilities)(?:\/|$)/i.test(req.path) ||
  /^\/api\/auth\/(?:session|legal|csrf)\/?$/i.test(req.path)
);
const apiLimiter = (req,res,next) => {
  req.accountReadBudget = protectedRead(req);
  return (req.accountReadBudget ? failedAccess : publicAndWrite)(req,res,next);
};
const verifiedReadLimiter = (req,res,next) => req.accountReadBudget ? accountReads(req,res,next) : next();

module.exports = { apiLimiter, verifiedReadLimiter };
