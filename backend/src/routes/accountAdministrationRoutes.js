const express=require('express');
const {list,create,status,assignment,reset}=require('../controllers/accountAdministrationController');
const router=express.Router();
router.get('/',list);
router.post('/',create);
router.patch('/:id/status',status);
router.patch('/:id/assignment',assignment);
router.post('/:id/password-reset',reset);
module.exports=router;
