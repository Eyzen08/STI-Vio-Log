const ExcelJS = require('exceljs');
const { REPORT_TITLES, reportColumns, reportValues, reportCell, reportFilename, statusLabel } = require('../../../shared/reportPresentation.mjs');
const { formatDisplayLabel, formatManilaDateTime } = require('../../../shared/displayFormat.mjs');
const { reportSortLabel } = require('../../../shared/adminReports.mjs');

const createReportWorkbook = (type, payload, filters = {}, generatedAt = new Date()) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'STI Vio-Log'; workbook.created = generatedAt;
  const filterLabels = Object.entries(filters).filter(([,value]) => value !== '' && value != null).map(([key,value]) => {
    const label = key === 'student_id' ? 'Student' : key === 'department_id' ? 'Department' : key === 'assignment_id' ? 'Assignment' : formatDisplayLabel(key);
    return `${label}: ${key.endsWith('_id') ? `#${value}` : key==='sort_by' ? reportSortLabel(value) : key==='status' ? statusLabel(value) : String(value)}`;
  });
  const addSheet = (name, schema, rows) => {
    const columns = reportColumns(schema);
    const sheet = workbook.addWorksheet(name,{views:[{state:'frozen',ySplit:6}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:6'}});
    columns.forEach(({width},index) => {sheet.getColumn(index+1).width=width;});
    sheet.addRow([name]); sheet.addRow([`Generated: ${formatManilaDateTime(generatedAt)} · Asia/Manila`]);
    sheet.addRow([`Filters: ${filterLabels.join(' · ') || 'All records'}`]);
    for(let row=1;row<=3;row++)sheet.mergeCells(row,1,row,columns.length);
    sheet.getRow(1).font={bold:true,size:18,color:{argb:'FF123553'}};sheet.getRow(1).height=32;sheet.getRow(3).height=30;
    sheet.addRow(['Records',rows.length]);sheet.addRow([]);sheet.addRow(columns.map(column=>column.label));
    sheet.getRow(6).height=30;sheet.getRow(6).eachCell(cell=>{cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF123553'}};});
    for(const source of rows){
      const values=reportValues(schema,source);
      const row=sheet.addRow(columns.map(({key})=>typeof values[key]==='number'&&!/(hours|minutes)$/.test(key)?values[key]:reportCell(key,values[key],source)));
      row.height=Math.min(409,Math.max(30,...row.values.slice(1).map((value,index)=>String(value??'').split('\n').reduce((lines,line)=>lines+Math.max(1,Math.ceil(line.length/(columns[index].width-2))),0)*15+8)));
    }
    sheet.eachRow(row=>row.eachCell(cell=>{cell.alignment={vertical:'top',horizontal:'left',wrapText:true};}));
    sheet.getColumn(2).numFmt='@';
    sheet.autoFilter={from:{row:6,column:1},to:{row:Math.max(6,sheet.rowCount),column:columns.length}};
  };
  addSheet(type==='dtr'?'DTR Attendance Report':REPORT_TITLES[type],type,payload.data || []);
  if(type==='dtr')addSheet('Hour Corrections','corrections',payload.hourCorrections || []);
  return workbook;
};
module.exports = { createReportWorkbook, reportFilename };
