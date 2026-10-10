const ExcelJS = require('exceljs');
const { REPORT_TITLES, reportColumns, reportValues, reportCell, reportFilename, statusLabel } = require('../../../shared/reportPresentation.mjs');
const { formatDisplayLabel, formatManilaDateTime } = require('../../../shared/displayFormat.mjs');
const { reportSortLabel } = require('../../../shared/adminReports.mjs');

const formatReportSheet = (sheet, identifyingColumns = 0) => {
  sheet.views = [{ state: 'frozen', ySplit: 6, xSplit: identifyingColumns, showGridLines: false }];
  sheet.pageSetup = { orientation: 'landscape', fitToPage: false, scale: 100, printTitlesRow: '6:6',
    ...(identifyingColumns ? { printTitlesColumn: `A:${sheet.getColumn(identifyingColumns).letter}` } : {}),
    printArea: `A1:${sheet.getColumn(sheet.columnCount).letter}${sheet.rowCount}` };
  sheet.eachRow((row, rowNumber) => {
    let lines = 1;
    row.eachCell((cell, columnNumber) => {
      if (cell.isMerged && cell.master !== cell) return;
      cell.font = { name: 'Arial', size: 11, color: { argb: 'FF123553' } };
      cell.alignment = { vertical: 'top', horizontal: typeof cell.value === 'number' ? 'right' : 'left', wrapText: true };
      if (typeof cell.value === 'number') cell.numFmt = '0';
      const width = cell.isMerged ? sheet.columns.reduce((sum, column) => sum + column.width, 0) : sheet.getColumn(columnNumber).width;
      const text = cell.value instanceof Date ? '0000-00-00' : String(cell.value ?? '');
      lines = Math.max(lines, text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / (width - 2))), 0));
      if (rowNumber === 6) {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123553' } };
      } else if (rowNumber > 6) {
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFDCE5ED' } } };
      }
    });
    row.height = Math.min(409, Math.max(rowNumber === 6 ? 30 : 24, lines * 15 + 8));
  });
  sheet.getCell('A1').font = { name: 'Arial', bold: true, size: 18, color: { argb: 'FF123553' } };
  sheet.getRow(1).height = 32;
  sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } };
};

const createReportWorkbook = (type, payload, filters = {}, generatedAt = new Date()) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'STI Vio-Log'; workbook.created = generatedAt;
  const filterLabels = Object.entries(filters).filter(([,value]) => value !== '' && value != null).map(([key,value]) => {
    const label = key === 'student_id' ? 'Student' : key === 'department_id' ? 'Department' : key === 'assignment_id' ? 'Assignment' : formatDisplayLabel(key);
    return `${label}: ${key.endsWith('_id') ? `#${value}` : key==='sort_by' ? reportSortLabel(value) : key==='status' ? statusLabel(value) : String(value)}`;
  });
  const addSheet = (name, schema, rows) => {
    const columns = reportColumns(schema);
    const sheet = workbook.addWorksheet(name);
    columns.forEach(({width},index) => {sheet.getColumn(index+1).width=Math.min(48,width);});
    sheet.addRow([name]); sheet.addRow([`Generated: ${formatManilaDateTime(generatedAt)}`]);
    sheet.addRow([`Filters: ${filterLabels.join(' · ') || 'All records'}`]);
    for(let row=1;row<=3;row++)sheet.mergeCells(row,1,row,columns.length);
    sheet.addRow(['Records',rows.length]);sheet.addRow([]);sheet.addRow(columns.map(column=>column.label));
    for(const source of rows){
      const values=reportValues(schema,source);
      sheet.addRow(columns.map(({key})=>typeof values[key]==='number'&&key!=='year_level'&&!/(hours|minutes)$/.test(key)?values[key]:reportCell(key,values[key],source)));
    }
    formatReportSheet(sheet, 2);
    sheet.getColumn(2).numFmt='@';
  };
  addSheet(type==='dtr'?'DTR Attendance Report':REPORT_TITLES[type],type,payload.data || []);
  if(type==='dtr')addSheet('Hour Corrections','corrections',payload.hourCorrections || []);
  return workbook;
};
module.exports = { createReportWorkbook, reportFilename, formatReportSheet };
