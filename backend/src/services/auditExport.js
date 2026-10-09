const ExcelJS = require('exceljs');
const { auditActorLabel, auditDetailRows, auditRecordLabel, auditRecordType, auditSummary, formatAuditAction } = require('../../../shared/auditLog.mjs');
const { formatDisplayLabel, formatManilaDateTime } = require('../../../shared/displayFormat.mjs');
const { formatReportSheet } = require('./reportExport');

const auditExportFilename = (time) => `STI_Vio-Log_Audit_Log_${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(time)}.xlsx`;
const createAuditWorkbook = (entries, filters = {}, generatedAt = new Date()) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'STI Vio-Log'; workbook.created = generatedAt;
  const sheet = workbook.addWorksheet('Audit Log');
  const headers = ['Event ID', 'Date/Time', 'Actor', 'Role', 'Action', 'Record', 'Affected Person', 'Student Number/Username', 'Department', 'Description', 'Details'];
  const widths = [12, 24, 24, 20, 24, 36, 24, 24, 24, 48, 48];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  const filterLabels = [filters.action && `Action: ${formatAuditAction(filters.action)}`, filters.table_name && `Record type: ${auditRecordType(filters.table_name)}`, filters.user_id && `Actor: User #${filters.user_id}`, filters.from_date && `From: ${filters.from_date}`, filters.to_date && `Through: ${filters.to_date}`].filter(Boolean);
  sheet.addRow(['STI Vio-Log — Audit Log']); sheet.mergeCells('A1:K1');
  sheet.addRow([`Generated: ${formatManilaDateTime(generatedAt)}`]); sheet.mergeCells('A2:K2');
  sheet.addRow([`Filters: ${filterLabels.join(' · ') || 'All activities'}`]); sheet.mergeCells('A3:K3');
  sheet.addRow(['Events', entries.length]);
  sheet.addRow([]); sheet.addRow(headers);
  for (const entry of entries) {
    const context = entry.record_context || {};
    sheet.addRow([
      String(entry.id), formatManilaDateTime(entry.created_at), auditActorLabel(entry),
      formatDisplayLabel(entry.actor_role, entry.user_id ? 'Role not recorded' : 'System'), formatAuditAction(entry.action),
      [auditRecordLabel(entry), context.violation_label, context.certificate_number].filter(Boolean).join('\n'),
      context.subject_name || '', context.subject_identifier || '', context.department_name || '', auditSummary(entry),
      [entry.actor_name && entry.actor_username && `Actor username: ${entry.actor_username}`, ...auditDetailRows(entry).map(({ label, value }) => `${label}: ${value}`)].filter(Boolean).join('\n')
    ]);
  }
  formatReportSheet(sheet, 3);
  sheet.getColumn(1).numFmt = '@'; sheet.getColumn(8).numFmt = '@';
  return workbook;
};

module.exports = { createAuditWorkbook, auditExportFilename };
