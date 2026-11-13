'use strict';
// Pure checked transformations over reviewed native source. No filesystem/network.
function once(source,anchor,replacement,label){if(typeof source!=='string'||source.split(anchor).length!==2)throw Error('Anchor nativo incompatible: '+label);return source.replace(anchor,replacement);}
function store(source){
 if(typeof source!=='string'||source.includes('employeeResourcesCommitVersion')||source.includes("require('./employee-resources-policy')"))throw Error('Store laboral ya integrado o incompatible.');
 const anchors=['const api={read,acquire,commit,abort,','const api={read,readQuery,acquire,commit,abort,'],matches=anchors.filter(a=>source.includes(a));
 if(matches.length!==1||source.split(matches[0]).length!==2)throw Error('Anchor nativo incompatible: store readiness');
 source=once(source,"const override=service('commit',lease,actor);","const override=service('commit',lease,actor);Object.assign(override.token,require('./employee-resources-policy').reserved(actor?.claims));if(actor?.employeeResources||actor.operation?.startsWith('employee-resources-')){Object.assign(override.token,require('./employee-resources-policy').validate(actor,lease,patch));}",'store commit');
 source=once(source,matches[0],matches[0].replace('const api={','const api={employeeResourcesCommitVersion:1,'),'store readiness');return source;
}
function index(source){
 return route(once(source,"const employeeAvailability = require('./employee-availability')","const employeeResources=require('./employee-resources').create({authorize:laborWriteGateway.authorize,store:laborRuntime.store,guard:laborRuntime.guard,enabled:laborScopedEnabled&&process.env.EMPLOYEE_RESOURCES_ENABLED==='true'});\nconst employeeResourcesHTTP=require('./employee-resources-http').create({service:employeeResources,readBody,send});\nconst employeeAvailability = require('./employee-availability')",'index service'));
}
function route(source){if(source.includes('await employeeResourcesHTTP(req,res)'))throw Error('Ruta laboral ya integrada.');const anchor='  const pathname = requestUrl.pathname;';return once(source,anchor,anchor+"\n  if(req.method!=='OPTIONS'&&await employeeResourcesHTTP(req,res))return;",'index route');}
module.exports={store,index,route};
