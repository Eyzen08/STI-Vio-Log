const test = require('node:test');
const assert = require('node:assert/strict');

const router = require('../src/routes/communityServiceRoutes');

function getRouteSummary() {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));
}

test('community service routes expose full CRUD surface', () => {
  const routes = getRouteSummary();

  assert(routes.some((route) => route.path === '/' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/assignment-options' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/results/pending' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/results/:sessionId/review' && route.methods.includes('post')));
  assert(routes.some((route) => route.path === '/active-sessions' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/' && route.methods.includes('post')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('put')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('delete')));
});

test('pause and resume expose staff-scoped POST routes with the Time Out authorization gates',async()=>{
  const timeOut=router.stack.find(layer=>layer.route?.path==='/attendance/time-out').route;
  for (const action of ['pause','resume']) {
    const route=router.stack.find(layer=>layer.route?.path===`/sessions/:sessionId/${action}`)?.route;
    assert.ok(route,`missing ${action} route`);assert.equal(route.methods.post,true);
    assert.deepEqual(route.stack.slice(0,-1).map(layer=>layer.handle),timeOut.stack.slice(0,-1).map(layer=>layer.handle));
    const res={statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};
    let continued=false;
    await route.stack[0].handle({body:{},params:{sessionId:'8'}},res,()=>{continued=true});
    assert.equal(res.statusCode,401);assert.equal(continued,false);
  }
});

test('pause and resume reject actor, department and timing overrides before service writes',async()=>{
  const originalError=console.error;console.error=()=>{};
  try {
    for (const action of ['pause','resume']) {
      const route=router.stack.find(layer=>layer.route?.path===`/sessions/:sessionId/${action}`)?.route;
      assert.ok(route,`missing ${action} route`);
      const handler=route.stack.at(-1).handle;
      for (const override of [{actor_id:99},{department_id:99},{paused_at:'2026-10-07T01:00:00Z'},{paused_seconds:0},{session_id:99},...(action==='resume'?[{reason:'Injected resume reason'}]:[])]) {
        const res={statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};
        await handler({user:{id:2,role:'DEPARTMENT_HEAD',department_id:7},staffDepartmentId:7,params:{sessionId:'8'},body:{...(action==='pause'?{reason:'Lunch'}:{}),...override},ip:'127.0.0.1'},res);
        assert.equal(res.statusCode,400);assert.match(res.body.message,/Unsupported field/);
      }
    }
  } finally {console.error=originalError;}
});
