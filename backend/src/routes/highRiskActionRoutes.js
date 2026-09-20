const router=require('express').Router();
const rateLimit=require('express-rate-limit');
const {authorizeRoles}=require('../middleware/authMiddleware');
const controller=require('../controllers/highRiskActionController');
const limiter=rateLimit({windowMs:15*60*1000,max:20,standardHeaders:true,legacyHeaders:false});
router.get('/',authorizeRoles('DISCIPLINE_ADMIN'),controller.list);
router.post('/step-up',limiter,authorizeRoles('DISCIPLINE_ADMIN'),controller.stepUp);
router.post('/execute',limiter,authorizeRoles('DISCIPLINE_ADMIN'),controller.executeDirect);
module.exports=router;
