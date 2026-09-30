const assert = require('node:assert/strict');
const core = require('../assets/criterial-core.js');

const config = {
  bands: [
    { id: 'BAJO', min: 0, max: 2.99 },
    { id: 'MEDIO', min: 3, max: 3.99 },
    { id: 'ALTO', min: 4, max: 4.49 },
    { id: 'SUPERIOR', min: 4.5, max: 5 },
  ],
  thresholds: { INTRODUCE: 3, REFUERZA: 3.5, DOMINA: 4 },
  minimumN: 5,
  margin: 10,
  divergenceTolerance: 15,
  saberProMinimumLevel: 3,
  kpis: {},
  modules: [],
};

assert.equal(core.validateBands(config.bands), '', 'las bandas cubren la escala completa');
assert.match(core.validateBands([{...config.bands[0],max:2.8},...config.bands.slice(1)]), /contiguas/);

const subjects = [
  {id:'a',name:'Asignatura A',semester:1,credits:3,ra1:'INTRODUCE',nature:'Teórica'},
  {id:'b',name:'Asignatura B',semester:1,credits:2,ra1:'DOMINA',nature:'Práctica'},
];
const raList = [{id:'RA1'}];
const rows = [
  {estudiante:'COD-1',asignatura:'Asignatura A',nota:'4.0',periodo:'2025-1'},
  {estudiante:'COD-1',asignatura:'Asignatura A (P) + (1 hora T)',nota:'4.0',periodo:'2025-1'},
  {estudiante:'COD-1',asignatura:'Asignatura B',nota:'3.6',periodo:'2025-1'},
  {estudiante:'COD-1',asignatura:'Asignatura A',nota:'9',periodo:'2025-1'},
  {estudiante:'COD-2',asignatura:'No existe',nota:'4.8',periodo:'2025-1'},
];
const criteria = core.computeCriterial({rows,subjects,raList,config});
assert.equal(criteria.length,1,'las filas inválidas se excluyen sin bloquear las válidas');
assert.equal(criteria[0].evidenceCount,3);
assert.equal(criteria[0].score,3.84,'nota criterial promedia duplicados por asignatura y pondera por créditos');
assert.equal(criteria[0].threshold,3.4,'umbral esperado ponderado por créditos');
assert.equal(criteria[0].achieves,true);

assert.equal(core.quantile([1,2,3,4,5],0.25),2,'Q1 usa interpolación lineal');
assert.equal(core.quantile([1,2,3,4,5],0.5),3);
assert.equal(core.quantile([1,2,3,4,5],0.75),4,'Q3 usa interpolación lineal');

const pairs=[];
for(let i=0;i<20;i++)pairs.push({left:true,right:true});
for(let i=0;i<5;i++)pairs.push({left:true,right:false});
for(let i=0;i<10;i++)pairs.push({left:false,right:true});
for(let i=0;i<65;i++)pairs.push({left:false,right:false});
const agreement=core.cohenKappa(pairs);
assert.equal(agreement.agreement,85);
assert.ok(Math.abs(agreement.kappa-0.625)<1e-12,'kappa de Cohen coincide con la tabla 20/5/10/65');

const legacy={rows:[{estudiante:'COD-ANTERIOR',nota:'4.1'}],uploads:[{file:'previo.csv'}],decisions:{}};
const migrated=core.migrateState(legacy,{curricularVersion:'V20',approved:false,config,sources:{saberPro:[],perception:[],stakeholders:[]},imports:{}});
assert.deepEqual(migrated.rows,legacy.rows,'los registros previos en localStorage se conservan');
assert.deepEqual(migrated.uploads,legacy.uploads,'el historial previo se conserva');
assert.equal(migrated.curricularVersion,'V20');

const defaults={curricularVersion:'V20',approved:false,config:{...config,kpis:{KPI1:{ra:'RA1',target:80,scope:'domina',minimumBand:'ALTO'},KPI2:{ra:'RA2',target:75,scope:'all',minimumBand:'MEDIO'}}},sources:{saberPro:[],perception:[],stakeholders:[]},imports:{}};
const partial=core.migrateState({config:{kpis:{KPI1:{target:90}}}},defaults);
assert.equal(partial.config.kpis.KPI1.target,90,'una configuración parcial actualiza solo el campo incluido');
assert.equal(partial.config.kpis.KPI1.scope,'domina','los valores KPI predeterminados restantes se conservan');
assert.equal(partial.config.kpis.KPI2.target,75,'se preservan otros KPI que no venían en la configuración importada');

console.log('OK: bandas, ponderación criterial por créditos, alias de asignatura, cuantiles, kappa, exclusión de filas inválidas y migración compatible.');
