const test = require('node:test');
const assert = require('node:assert/strict');

const router = require('../src/routes/studentRoutes');

function getRouteSummary() {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));
}

test('student routes expose full CRUD surface', () => {
  const routes = getRouteSummary();

  assert(routes.some((route) => route.path === '/' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/' && route.methods.includes('post')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('put')));
  assert(routes.some((route) => route.path === '/:id/password-reset' && route.methods.includes('post')));
  assert(routes.some((route) => route.path === '/:id/credentials-email' && route.methods.includes('post')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('delete')));
});

test('credential emailing allows only Discipline Admin and Discipline Office',async()=>{
  const route=router.stack.find(layer=>layer.route?.path==='/:id/credentials-email').route;
  const authorize=route.stack[0].handle;
  for(const role of ['DISCIPLINE_ADMIN','DISCIPLINE_OFFICE','STUDENT','SYSTEM_ADMIN','DEPARTMENT_HEAD',null]){
    const req={user:role?{role}:undefined};
    const res={statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};
    let allowed=false;
    await authorize(req,res,()=>{allowed=true});
    assert.equal(allowed,['DISCIPLINE_ADMIN','DISCIPLINE_OFFICE'].includes(role),String(role));
    if(!allowed)assert.equal(res.statusCode,role?403:401);
  }
});
