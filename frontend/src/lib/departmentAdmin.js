export const buildDepartmentPayload=(form={})=>({department_code:String(form.code||'').trim().toUpperCase(),department_name:String(form.name||'').trim(),description:String(form.description||'').trim()||undefined})
export const departmentCanDeactivate=(department)=>Number(department?.active_accounts||0)===0
export const departmentFormCopy={departmentLabel:'Department',departmentPlaceholder:'Library Department',officerLabel:'Department Officer',officerPlaceholder:'Name of Officer'}
