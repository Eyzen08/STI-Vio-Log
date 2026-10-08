const { loadViolationReport, loadCommunityServiceReport, loadNonComplianceReport } = require('./reportController');
const { loadParentContactReport, loadClearanceReport, loadGoodStandingReport } = require('./extendedReportController');
const { loadDTRReport } = require('./communityServiceSessionReportController');
const { createReportWorkbook, reportFilename } = require('../services/reportExport');
const { sendError } = require('../utils/api');

const LOADERS = {'community-service':loadCommunityServiceReport,dtr:loadDTRReport,'non-compliance':loadNonComplianceReport,'parent-contacts':loadParentContactReport,clearance:loadClearanceReport,'good-standing':loadGoodStandingReport,violations:loadViolationReport};
const exportReport = type => async (req,res) => {
  try {
    const payload=await LOADERS[type](req),generatedAt=new Date();
    const buffer=await createReportWorkbook(type,payload,req.query,generatedAt).xlsx.writeBuffer();
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${reportFilename(type,generatedAt)}"`);
    res.setHeader('Cache-Control','no-store');
    return res.status(200).send(Buffer.from(buffer));
  } catch(error){return sendError(res,error.statusCode||500,error.code||'REPORT_EXPORT_FAILED',error.statusCode?error.message:'Unable to export this report. Please try again.');}
};
module.exports = { exportReport };
