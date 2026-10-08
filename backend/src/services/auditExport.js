const ExcelJS = require('exceljs');
const { auditActorLabel, auditDetailRows, auditRecordLabel, auditRecordType, auditSummary, formatAuditAction } = require('../../../shared/auditLog.mjs');
const { formatDisplayLabel, formatManilaDateTime } = require('../../../shared/displayFormat.mjs');

const auditExportFilename = (time) => `STI_Vio-Log_Audit_Log_${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(time)}.xlsx`;
const createAuditWorkbook = (entries, filters = {}, generatedAt = new Date()) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'STI Vio-Log'; workbook.created = generatedAt;
  const sheet = workbook.addWorksheet('Audit Log', { views: [{ state: 'frozen', ySplit: 6 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:6' } });
  const headers = ['Event ID', 'Date/Time (Manila)', 'Actor', 'Role', 'Action', 'Record', 'Affected Person', 'Student Number/Username', 'Department', 'Description', 'Details'];
  const widths = [14, 26, 26, 24, 28, 45, 26, 25, 26, 65, 65];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  const filterLabels = [filters.action && `Action: ${formatAuditAction(filters.action)}`, filters.table_name && `Record type: ${auditRecordType(filters.table_name)}`, filters.user_id && `Actor: User #${filters.user_id}`, filters.from_date && `From: ${filters.from_date}`, filters.to_date && `Through: ${filters.to_date}`].filter(Boolean);
  sheet.addRow(['STI Vio-Log — Audit Log']); sheet.mergeCells('A1:K1');
  sheet.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FF123553' } }; sheet.getRow(1).height = 32;
  sheet.addRow([`Generated: ${formatManilaDateTime(generatedAt)} · Asia/Manila`]); sheet.mergeCells('A2:K2');
  sheet.addRow([`Filters: ${filterLabels.join(' · ') || 'All activities'}`]); sheet.mergeCells('A3:K3');
  sheet.getRow(3).height = 30;
  sheet.addRow(['Events', entries.length]);
  sheet.addRow([]); sheet.addRow(headers);
  sheet.getRow(6).height = 30;
  sheet.getRow(6).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123553' } };
  });
  for (const entry of entries) {
    const context = entry.record_context || {};
    const row = sheet.addRow([
      String(entry.id), formatManilaDateTime(entry.created_at), auditActorLabel(entry),
      formatDisplayLabel(entry.actor_role, entry.user_id ? 'Role not recorded' : 'System'), formatAuditAction(entry.action),
      [auditRecordLabel(entry), context.violation_label, context.certificate_number].filter(Boolean).join('\n'),
      context.subject_name || '', context.subject_identifier || '', context.department_name || '', auditSummary(entry),
      [entry.actor_name && entry.actor_username && `Actor username: ${entry.actor_username}`, ...auditDetailRows(entry).map(({ label, value }) => `${label}: ${value}`)].filter(Boolean).join('\n')
    ]);
    row.height = Math.min(409, Math.max(30, ...row.values.slice(1).map((value, index) => String(value || '').split('\n').reduce((lines, line) => lines + Math.max(1, Math.ceil(line.length / (widths[index] - 2))), 0) * 15 + 8)));
  }
  sheet.eachRow((row) => row.eachCell((cell) => { cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }; }));
  sheet.getColumn(1).numFmt = '@'; sheet.getColumn(8).numFmt = '@';
  sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(6, sheet.rowCount), column: headers.length } };
  return workbook;
};

module.exports = { createAuditWorkbook, auditExportFilename };
