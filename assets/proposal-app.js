/* Módulo independiente para la propuesta de Fisioterapia V20. */
(() => {
  const data = window.CORA_FISIO_V20;
  if (!data) return;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = (v) => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  const courseKey = (v) => normalize(v).replace(/\s*\((?:t|tp|p)\)(?:\s*\+\s*\(1 hora t\))?\s*$/i, '').replace(/\s+/g, ' ').trim();
  const courses = data.subjects;
  const raList = data.ra;
  const courseById = new Map(courses.map(x => [x.id, x]));
  const courseByName = new Map();
  for (const course of courses) {
    courseByName.set(courseKey(course.name), course);
    courseByName.set(normalize(course.name), course);
  }
  const aliases = new Map([
    ['practica iii actividad fisica y deporte', 'practica iii (af + d)'],
    ['practica iii af+d', 'practica iii (af + d)'],
  ]);
  const storageKey = 'cora-fisioterapia-propuesta-v20-v1';
  const freshState = () => ({ rows: [], uploads: [] });
  let state;
  try { state = JSON.parse(localStorage.getItem(storageKey)) || freshState(); } catch { state = freshState(); }
  let chosenRAs = new Set(raList.map(x => x.id));
  let chosenPeriodRAs = new Set(raList.map(x => x.id));
  let chosenSemesters = new Set(courses.map(x => String(x.semester)));
  let graph3D = null;
  let focusedCourse = '';
  let graphMode = '3d';
  let graphZoom = 1;
  let proposalPanStart = null;
  let proposalPanMoved = false;

  function save() { localStorage.setItem(storageKey, JSON.stringify(state)); renderAll(); }
  function semesterSort(a, b) { return Number(a) - Number(b); }
  function courseFor(name) {
    const exact = normalize(name);
    const base = aliases.get(courseKey(name)) || courseKey(name);
    return courseByName.get(exact) || courseByName.get(base) || null;
  }
  function levelFactor(level) { return data.levelFactors[level] || 0; }
  function levelName(level) { return ({ INTRODUCE:'Introduce', REFUERZA:'Refuerza', DOMINA:'Domina' })[level] || 'Sin aporte'; }
  function status(row) {
    const noteText = String(row.nota ?? '').trim().replace(',', '.');
    const note = Number(noteText);
    if (!row.estudiante || !row.asignatura || !noteText || !Number.isFinite(note) || note < 0 || note > 5) return 'ERROR DE DATOS';
    if (!courseFor(row.asignatura)) return 'ASIGNATURA NO RECONOCIDA';
    return 'VÁLIDA';
  }
  function periodSort(p) { const m = String(p).match(/(\d{4})\D*(\d)/); return m ? Number(m[1]) * 10 + Number(m[2]) : Number.MAX_SAFE_INTEGER; }
  function validRows() { return state.rows.filter(r => status(r) === 'VÁLIDA'); }
  function recordContributions(row) {
    const course = courseFor(row.asignatura);
    if (!course) return [];
    const score = Number(String(row.nota).replace(',', '.'));
    return raList.flatMap(ra => {
      const level = course[ra.id.toLowerCase()];
      return level ? [{ ra:ra.id, level, score:score * levelFactor(level), factor:levelFactor(level) }] : [];
    });
  }
  function results() {
    const raw = new Map(), studentCourse = new Map();
    for (const row of validRows()) {
      const course = courseFor(row.asignatura);
      for (const contribution of recordContributions(row)) {
        const period = row.periodo || 'Sin periodo', semester = course.semester;
        const key = [period, semester, contribution.ra].join('|');
        const cell = raw.get(key) || { period, semester, ra:contribution.ra, sum:0, factors:0, count:0 };
        cell.sum += contribution.score; cell.factors += contribution.factor; cell.count++;
        raw.set(key, cell);
        const skey = [period, semester, course.id, contribution.ra, row.estudiante].join('|');
        const studentCell = studentCourse.get(skey) || { period, semester, course, ra:contribution.ra, student:row.estudiante, sum:0, count:0, factor:contribution.factor };
        studentCell.sum += contribution.score; studentCell.count++;
        studentCourse.set(skey, studentCell);
      }
    }
    const means = new Map();
    for (const cell of studentCourse.values()) {
      const key = [cell.period, cell.semester, cell.course.id, cell.ra].join('|');
      const item = means.get(key) || { period:cell.period, semester:cell.semester, course:cell.course, ra:cell.ra, factor:cell.factor, scores:[] };
      item.scores.push(cell.sum / cell.count); means.set(key,item);
    }
    const courseMeans = [...means.values()].map(c => ({...c, score:c.scores.reduce((a,b)=>a+b,0)/c.scores.length}));
    return [...raw.values()].map(item => {
      const rows = courseMeans.filter(c => c.period === item.period && c.semester === item.semester && c.ra === item.ra && c.course.credits > 0);
      const credits = rows.reduce((s,c)=>s+c.course.credits,0), factorCredits = rows.reduce((s,c)=>s+c.course.credits*c.factor,0);
      return { ...item, direct:item.sum/item.count, credit:credits?rows.reduce((s,c)=>s+c.score*c.course.credits,0)/credits:null, comparable:factorCredits?rows.reduce((s,c)=>s+c.score*c.course.credits,0)/factorCredits:null, averageFactor:item.factors/item.count };
    }).sort((a,b)=>periodSort(a.period)-periodSort(b.period)||semesterSort(a.semester,b.semester)||a.ra.localeCompare(b.ra));
  }
  function escapeCsvCell(v) { return '"'+String(v??'').replace(/"/g,'""')+'"'; }
  function download(name, text, type) { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
  function parseCsv(text) {
    text=String(text).replace(/^\uFEFF/,'');
    const first = String(text).split(/\r?\n/,1)[0] || '';
    let quoted=false, commas=0, semis=0;
    for (let i=0;i<first.length;i++) { if(first[i]==='"'&&first[i+1]==='"'){i++;continue;} if(first[i]==='"'){quoted=!quoted;continue;} if(!quoted){if(first[i]===',')commas++;if(first[i]===';')semis++;} }
    const delimiter=semis>commas?';':','; const lines=[]; let row=[],field='',inQuotes=false;
    for(let i=0;i<text.length;i++) { const ch=text[i]; if(ch==='"'&&inQuotes&&text[i+1]==='"'){field+='"';i++;} else if(ch==='"'){inQuotes=!inQuotes;} else if(ch===delimiter&&!inQuotes){row.push(field);field='';} else if((ch==='\n'||ch==='\r')&&!inQuotes){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))lines.push(row);row=[];field='';} else field+=ch; }
    if(field||row.length){row.push(field);lines.push(row);} if(!lines.length)return [];
    const headers=lines.shift().map((h)=>normalize(h).replace(/[ _-]+/g,''));
    const index=(...names)=>headers.findIndex(h=>names.includes(h));
    const ix={asignatura:index('asignatura','curso','materia'),estudiante:index('estudiante','alumno','nombre'),nota:index('nota','calificacion','calificación'),actividad:index('actividad','evaluacion','evaluación'),instrumento:index('instrumento'),codigo:index('codigoactividad','codigo','codigoactividad')};
    if(ix.asignatura<0||ix.estudiante<0||ix.nota<0)throw new Error('El CSV debe incluir las columnas asignatura, estudiante y nota. Descargue la plantilla CORA V20 si necesita un ejemplo.');
    return lines.map((cells,i)=>({line:i+2,asignatura:(cells[ix.asignatura]||'').trim(),estudiante:(cells[ix.estudiante]||'').trim(),nota:(cells[ix.nota]||'').trim(),actividad:ix.actividad<0?'':(cells[ix.actividad]||'').trim(),instrumento:ix.instrumento<0?'':(cells[ix.instrumento]||'').trim(),codigoActividad:ix.codigo<0?'':(cells[ix.codigo]||'').trim()}));
  }
  function switchView(id) {
    $$('.proposal-view').forEach(x=>x.classList.toggle('is-active',x.id===id));
    $$('.proposal-sidebar .nav-item[data-proposal-view]').forEach(x=>x.classList.toggle('is-active',x.dataset.proposalView===id));
    if(id==='proposal-interconexion') { requestAnimationFrame(()=>{ resizeGraph(); if(graphMode==='3d') render3D(); }); }
    if(id==='proposal-resultados') renderResults();
  }
  function raCard(ra) {
    const index=Number(ra.id.slice(-1))-1, comp=data.competencies[index], ind=data.indicators[index], profile=data.profile[index];
    return `<article class="proposal-ra-card"><div class="proposal-ra-card__top"><span>${esc(ra.id)}</span><strong>${esc(ra.name)}</strong></div><p>${esc(ra.description)}</p><details><summary>Competencia · ${esc(comp.name)}</summary><p>${esc(comp.description)}</p></details><details><summary>${esc(ind.name)}</summary><p>${esc(ind.description)}</p></details><small>${esc(profile.category)}</small></article>`;
  }
  function renderDashboard() {
    const credits=courses.reduce((s,c)=>s+c.credits,0), alerts=data.semesterQuality.filter(x=>x.status!=='CUMPLE');
    $('#proposal-metrics').innerHTML=[['46','Asignaturas'],[String(credits),'Créditos'],['9','Semestres'],[String(raList.length),'Resultados de aprendizaje']].map(([v,l])=>`<article class="metric"><span>${esc(l)}</span><strong>${esc(v)}</strong></article>`).join('');
    $('#proposal-ra-cards').innerHTML=raList.map(ra=>raCard(ra)).join('');
    $('#proposal-profile-text').innerHTML=data.profileStatement.map(p=>`<p>${esc(p)}</p>`).join('');
    $('#proposal-quality-summary').innerHTML=alerts.length?`<div class="proposal-quality-alerts">${alerts.map(x=>`<div class="notice notice--warning"><strong>Semestre ${x.semester}: ${esc(x.status.toLowerCase())}</strong> · ${x.credits} créditos · ${x.hoursTotal} horas totales${x.creditExcess?` · excede en ${x.creditExcess} crédito(s)`:''}${x.hoursExcess?` · excede en ${x.hoursExcess} hora(s)`:''}</div>`).join('')}</div>`:'<p class="muted">La matriz no reporta semestres por encima de los topes.</p>';
  }
  function renderUpload() {
    const diagnoses=state.rows.map(status), valid=diagnoses.filter(x=>x==='VÁLIDA').length, invalid=diagnoses.length-valid;
    $('#proposal-upload-summary').textContent=state.rows.length?`${valid} registros válidos · ${invalid} excluidos de ${state.rows.length}. Los datos pertenecen a Fisioterapia V20.`:'Aún no se ha cargado información para la propuesta.';
    $('#proposal-upload-log').innerHTML=state.uploads.length?state.uploads.slice().reverse().map(x=>`<tr><td>${esc(x.period)}</td><td>${esc(x.file)}</td><td>${x.total}</td><td>${x.valid}</td><td>${x.omitted}</td></tr>`).join(''):'<tr><td colspan="5" class="muted">Sin cargas registradas.</td></tr>';
    $('#proposal-row-quality').textContent=`${valid} válidos · ${diagnoses.filter(x=>x==='ERROR DE DATOS').length} con datos incompletos o nota inválida · ${diagnoses.filter(x=>x==='ASIGNATURA NO RECONOCIDA').length} con asignatura no reconocida.`;
    $('#proposal-records').innerHTML=state.rows.length?state.rows.slice(-250).reverse().map(r=>{const course=courseFor(r.asignatura);return `<tr><td>${esc(r.periodo)}</td><td>${esc(r.estudiante)}</td><td>${esc(r.asignatura)}</td><td>${course?course.semester:'—'}</td><td>${esc(r.actividad||'—')}${r.instrumento?`<small class="proposal-cell-sub">${esc(r.instrumento)}</small>`:''}</td><td>${esc(r.nota)}</td><td>${esc(status(r))}</td></tr>`;}).join(''):'<tr><td colspan="7" class="muted">No hay registros.</td></tr>';
  }
  function groupsByStudent() {
    const rows=[];
    for(const record of validRows()) { const c=courseFor(record.asignatura); for(const val of recordContributions(record)) rows.push({student:record.estudiante,period:record.periodo||'Sin periodo',semester:c.semester,ra:val.ra,score:val.score}); }
    return rows;
  }
  function renderRAChecks(targetId, selected, onChange) {
    const el=$(targetId); el.innerHTML=raList.map(ra=>`<label class="ra-chart-toggle"><input type="checkbox" value="${ra.id}" ${selected.has(ra.id)?'checked':''}><span>${ra.id}</span></label>`).join('');
    el.onchange=(e)=>{if(e.target.type!=='checkbox')return;if(e.target.checked)selected.add(e.target.value);else selected.delete(e.target.value);onChange();};
  }
  function drawBars(targetId, rows, semesters, ras, metric) {
    const target=$(targetId); const dataRows=rows.filter(r=>ras.has(r.ra)&&semesters.has(String(r.semester)));
    if(!dataRows.length){target.innerHTML='<span class="muted">No hay resultados válidos para los filtros seleccionados.</span>';return;}
    const labels=[...new Set(dataRows.map(x=>String(x.semester)))].sort(semesterSort), useRas=raList.filter(x=>ras.has(x.id));
    const width=Math.max(780,labels.length*115+90), height=380, left=58, right=20, top=24, bottom=78, ph=height-top-bottom, pw=width-left-right;
    const y=v=>top+(5-Math.max(0,Math.min(5,v)))*ph/5, col=ra=>({RA1:'#0f5c76',RA2:'#0b7a75',RA3:'#9b6041',RA4:'#715b9b',RA5:'#a0456a'})[ra]||'#516778';
    let svg=`<svg class="v20-bar-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Resultados ponderados por semestre para la propuesta V20"><title>Resultados ponderados por semestre · escala 0 a 5</title>`;
    for(let v=0;v<=5;v++)svg+=`<line class="gridline" x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}"/><text class="axis-label" x="${left-10}" y="${y(v)+4}" text-anchor="end">${v}</text>`;
    const slot=pw/labels.length, barW=Math.min(34,slot/(useRas.length+1));
    labels.forEach((sem,i)=>{
      svg+=`<text class="axis-label" x="${left+slot*(i+.5)}" y="${height-34}" text-anchor="middle">Semestre ${sem}</text>`;
      useRas.forEach((ra,j)=>{const item=dataRows.find(r=>String(r.semester)===sem&&r.ra===ra.id);if(!item)return;const value=item[metric];if(value==null)return;const x=left+slot*i+(slot-useRas.length*barW)/2+j*barW, yy=y(value), bh=top+ph-yy;svg+=`<rect x="${x+3}" y="${yy}" width="${barW-6}" height="${Math.max(1,bh)}" rx="4" fill="${col(ra.id)}"><title>${esc(ra.id)} · Semestre ${sem} · ${value.toFixed(2)} / 5 · ${item.count} evidencias</title></rect><text class="axis-label" x="${x+barW/2}" y="${Math.max(top+11,yy-5)}" text-anchor="middle">${value.toFixed(1)}</text>`;});
    });
    svg+='</svg><div class="proposal-chart-legend">'+useRas.map(ra=>`<span><i style="background:${col(ra.id)}"></i>${ra.id}</span>`).join('')+'</div>';target.innerHTML=svg;
  }
  function renderResults() {
    const rows=results(), periods=[...new Set(rows.map(x=>x.period))].sort((a,b)=>periodSort(a)-periodSort(b)||a.localeCompare(b));
    const populate=(selector,selected)=>{const el=$(selector),prev=el.value;el.innerHTML=periods.length?periods.map(p=>`<option>${esc(p)}</option>`).join(''):'<option value="">Sin datos</option>';el.value=periods.includes(selected||prev)?(selected||prev):(periods[0]||'');};
    populate('#proposal-chart-period'); populate('#proposal-table-period');
    $('#proposal-results-quality').textContent=state.rows.length?`Cálculo realizado con ${validRows().length} registros válidos; se omitieron ${state.rows.length-validRows().length} filas inválidas o sin asignatura reconocida.`:'Cargue notas válidas para ver los resultados. Las filas con error se omitirán y se usarán las demás.';
    const allSem=new Set(courses.map(c=>String(c.semester)));
    $('#proposal-semester-options').innerHTML=[...allSem].sort(semesterSort).map(s=>`<label class="semester-option"><input type="checkbox" value="${s}" ${chosenSemesters.has(s)?'checked':''}>Semestre ${s}</label>`).join('');
    $('#proposal-semester-options').onchange=e=>{if(e.target.type!=='checkbox')return;if(e.target.checked)chosenSemesters.add(e.target.value);else chosenSemesters.delete(e.target.value);drawProposalChart();};
    renderRAChecks('#proposal-ra-options',chosenRAs,drawProposalChart);
    renderRAChecks('#proposal-period-ra-options',chosenPeriodRAs,drawProposalTableChart);
    const buildCreditTable=()=>{
      $('#proposal-credit-head').innerHTML='<tr><th>Semestre</th>'+raList.map(ra=>`<th>${ra.id} · Introduce</th><th>${ra.id} · Refuerza</th><th>${ra.id} · Domina</th><th>Total</th>`).join('')+'</tr>';
      $('#proposal-credit-table').innerHTML=Array.from({length:9},(_,i)=>i+1).map(s=>{let cells='';for(const ra of raList){const totals=['INTRODUCE','REFUERZA','DOMINA'].map(level=>courses.filter(c=>c.semester===s&&c[ra.id.toLowerCase()]===level).reduce((sum,c)=>sum+c.credits,0));cells+=totals.map(n=>`<td>${n}</td>`).join('')+`<td><strong>${totals.reduce((a,b)=>a+b,0)}</strong></td>`;}return `<tr><th>Semestre ${s}</th>${cells}</tr>`;}).join('');
    }; buildCreditTable();
    $('#proposal-results-table').innerHTML=rows.length?rows.map(r=>`<tr><td>${esc(r.period)}</td><td>Semestre ${r.semester}</td><td>${r.ra}</td><td>${r.direct.toFixed(2)} / 5</td><td>${r.credit===null?'—':r.credit.toFixed(2)+' / 5'}</td><td>${r.comparable===null?'—':r.comparable.toFixed(2)+' / 5'}</td><td>${r.count}</td><td>${r.averageFactor.toFixed(2)}</td></tr>`).join(''):'<tr><td colspan="8" class="muted">No hay resultados válidos.</td></tr>';
    const students=[...new Set(validRows().map(x=>x.estudiante))].sort((a,b)=>a.localeCompare(b,'es'));
    const studentSel=$('#proposal-student'), before=studentSel.value;studentSel.innerHTML='<option value="">Todos</option>'+students.map(s=>`<option>${esc(s)}</option>`).join('');studentSel.value=students.includes(before)?before:'';
    const studentPeriod=$('#proposal-student-period'),oldPeriod=studentPeriod.value;studentPeriod.innerHTML='<option value="">Todos los periodos</option>'+periods.map(p=>`<option>${esc(p)}</option>`).join('');studentPeriod.value=periods.includes(oldPeriod)?oldPeriod:'';
    drawProposalChart();drawProposalTableChart();drawStudentChart();
  }
  function drawProposalChart(){const rows=results().filter(r=>r.period===$('#proposal-chart-period').value);drawBars('#proposal-chart',rows,chosenSemesters,chosenRAs,$('#proposal-chart-metric').value);}
  function drawProposalTableChart(){const rows=results().filter(r=>r.period===$('#proposal-table-period').value), sem=new Set(rows.map(r=>String(r.semester)));drawBars('#proposal-period-chart',rows,sem,chosenPeriodRAs,$('#proposal-table-metric').value);}
  function drawStudentChart(){const student=$('#proposal-student').value,period=$('#proposal-student-period').value,rows=groupsByStudent().filter(x=>(!student||x.student===student)&&(!period||x.period===period));const sums=new Map();for(const r of rows){const key=[r.semester,r.ra].join('|'),item=sums.get(key)||{semester:r.semester,ra:r.ra,sum:0,count:0};item.sum+=r.score;item.count++;sums.set(key,item);}const mapped=[...sums.values()].map(x=>({...x,period:'Trayectoria',direct:x.sum/x.count,count:x.count}));drawBars('#proposal-student-chart',mapped,new Set(mapped.map(x=>String(x.semester))),new Set(raList.map(r=>r.id)),'direct');}
  function renderCourses() {
    const search=normalize($('#proposal-course-search').value); $('#proposal-course-head').innerHTML='<tr><th>Sem.</th><th>Dimensión curricular</th><th>Asignatura</th><th>Créditos</th>'+raList.map(x=>`<th>${x.id} · nivel y aporte</th>`).join('')+'</tr>';
    const filtered=courses.filter(c=>!search||normalize(c.name).includes(search)||normalize(c.dimension).includes(search));
    $('#proposal-course-table').innerHTML=filtered.map(c=>`<tr><td>${c.semester}</td><td>${esc(c.dimension)}</td><td><button class="proposal-course-link" data-v20-focus="${c.id}">${esc(c.name)}</button></td><td>${c.credits}</td>${raList.map(ra=>{const level=c[ra.id.toLowerCase()],reason=c[ra.id.toLowerCase()+'Rationale'];return `<td>${level?`<span class="badge proposal-level proposal-level--${level.toLowerCase()}">${levelName(level)}</span>${reason?`<details><summary>Aporte</summary><small>${esc(reason)}</small></details>`:''}`:'Sin aporte'}</td>`;}).join('')}</tr>`).join('')||'<tr><td colspan="9">Sin asignaturas coincidentes.</td></tr>';
    $('#proposal-alignment-cards').innerHTML=raList.map(ra=>raCard(ra)).join('');
  }
  function renderChains(){
    $('#proposal-chains').innerHTML=data.chains.map(chain=>`<article class="proposal-chain panel"><div class="proposal-chain__heading"><div><p class="eyebrow">${esc(chain.id)} · ${esc(chain.ras)}</p><h3>${esc(chain.name)}</h3><p>${esc(chain.purpose)}</p></div><span class="badge">${chain.courseIds.length} asignaturas</span></div><div class="proposal-chain__sequence">${chain.courseIds.map((id,i)=>{const c=courseById.get(id);return `${i?'<b aria-hidden="true">→</b>':''}<button class="proposal-chain-course" data-v20-focus="${id}"><small>Semestre ${c.semester}</small><strong>${esc(c.name)}</strong></button>`;}).join('')}</div></article>`).join('');
  }
  function networkData() {
    const nodes=[...courses.map(c=>({id:c.id,name:c.name,kind:'asignatura',semester:c.semester,credits:c.credits,group:c.dimension})),...raList.map(r=>({id:r.id,name:r.name,kind:'ra',description:r.description})),...data.competencies.map(c=>({id:c.id,name:c.name,kind:'competencia',description:c.description})),...data.indicators.map(i=>({id:i.id,name:i.name,kind:'indicador',description:i.description})),...data.profile.map(p=>({id:p.id,name:p.category,kind:'perfil',description:p.competencyLabel}))];
    const links=[];
    for(const c of courses)for(const ra of raList){const level=c[ra.id.toLowerCase()];if(level)links.push({source:c.id,target:ra.id,kind:'aporte',level});}
    for(let i=0;i<raList.length;i++){links.push({source:raList[i].id,target:data.competencies[i].id,kind:'competencia'});links.push({source:raList[i].id,target:data.indicators[i].id,kind:'indicador'});links.push({source:raList[i].id,target:data.profile[i].id,kind:'perfil'});}
    for(const chain of data.chains)for(let i=1;i<chain.courseIds.length;i++)links.push({source:chain.courseIds[i-1],target:chain.courseIds[i],kind:'cadena',chain:chain.id});
    return {nodes,links};
  }
  function setFocusedCourse(id) {
    if (id !== focusedCourse) graphZoom = 1;
    focusedCourse=courseById.has(id)?id:'';
    $('#proposal-network-subject').value=focusedCourse;
    const course=courseById.get(focusedCourse);
    if(course){
      const raInfo=raList.flatMap((ra,i)=>course[ra.id.toLowerCase()]?[{ra,level:course[ra.id.toLowerCase()],comp:data.competencies[i],indicator:data.indicators[i],profile:data.profile[i]}]:[]);
      const chains=data.chains.filter(c=>c.courseIds.includes(course.id));
      const related=new Map();for(const ch of chains){const i=ch.courseIds.indexOf(course.id);for(const j of [i-1,i+1])if(ch.courseIds[j])related.set(ch.courseIds[j],courseById.get(ch.courseIds[j]));}
      $('#proposal-network-detail').innerHTML=`<h3>${esc(course.name)} <span class="badge">Semestre ${course.semester} · ${course.credits} créditos</span></h3><p>${esc(course.dimension)}</p><div class="proposal-related">${[...related.values()].map(x=>`<button class="button secondary" data-v20-focus="${x.id}">Sem. ${x.semester} · ${esc(x.name)}</button>`).join('')||'<span class="muted">Sin vecinas directas en las cadenas.</span>'}</div><div class="proposal-ra-cards">${raInfo.map(item=>`<article class="proposal-ra-card"><div class="proposal-ra-card__top"><span>${item.ra.id} · ${levelName(item.level)}</span><strong>${esc(item.ra.name)}</strong></div><p>${esc(item.ra.description)}</p><details open><summary>${esc(item.comp.name)}</summary><p>${esc(item.comp.description)}</p></details><details><summary>${esc(item.indicator.name)}</summary><p>${esc(item.indicator.description)}</p></details><small>${esc(item.profile.category)}</small><p class="muted">${esc(course[item.ra.id.toLowerCase()+'Rationale']||'')}</p></article>`).join('')}</div><p class="eyebrow">Cadenas: ${esc(chains.map(x=>x.id+' · '+x.name).join(' | ')||'Sin cadena asignada')}</p>`;
    } else $('#proposal-network-detail').innerHTML='<p class="muted">La red completa reúne malla, tributación, perfil y diez cadenas cognitivas. Seleccione una asignatura para ver el detalle.</p>';
    render3D(); render2D();
  }
  function activeNetwork() {
    const full=networkData();if(!focusedCourse)return full;
    const include=new Set([focusedCourse]);
    for(const link of full.links){if(link.source===focusedCourse||link.target===focusedCourse){include.add(link.source);include.add(link.target);}}
    const primary=[...include];for(const id of primary)for(const link of full.links)if(link.kind==='cadena'&&(link.source===id||link.target===id)){include.add(link.source);include.add(link.target);}
    return {nodes:full.nodes.filter(n=>include.has(n.id)),links:full.links.filter(l=>include.has(l.source)&&include.has(l.target))};
  }
  function render3D() {
    const host=$('#proposal-network-3d');if(!host||graphMode!=='3d')return;
    if(!window.ForceGraph3D){host.innerHTML='<div class="network-3d-fallback">La red 3D requiere conexión para cargar el motor gráfico. Cambie al mapa mental 2D para continuar.</div>';return;}
    if(!graph3D){
      graph3D=window.ForceGraph3D()(host).backgroundColor('#071222').showNavInfo(false).nodeId('id').nodeLabel(n=>`${n.name}${n.semester?` · Semestre ${n.semester}`:''}${n.credits?` · ${n.credits} créditos`:''}`).nodeColor(n=>({asignatura:'#47b9e5',ra:'#35cbb4',competencia:'#f0bf5b',indicador:'#e89557',perfil:'#d68bc9'})[n.kind]||'#ccc').nodeVal(n=>n.kind==='asignatura'?7.5:6.5).nodeRelSize(6.5).linkColor(l=>({aporte:'#41bda9',cadena:'#7da6c9',competencia:'#f0bf5b',indicador:'#e89557',perfil:'#d68bc9'})[l.kind]||'#9cb0c3').linkOpacity(.5).linkWidth(l=>l.kind==='cadena'?1.25:1).linkDirectionalParticles(l=>l.kind==='cadena'?1:0).linkDirectionalParticleWidth(1.7).enableNodeDrag(false).enableNavigationControls(true).onNodeClick(n=>{if(n.kind==='asignatura')setFocusedCourse(n.id);});
      host.addEventListener('contextmenu',e=>e.preventDefault());
    }
    graph3D.width(host.clientWidth||800).height(host.clientHeight||650).graphData(activeNetwork());
    if(focusedCourse){const n=courseById.get(focusedCourse);if(n)graph3D.cameraPosition({x:(n.semester-5)*38,y:0,z:250}, {x:(n.semester-5)*38,y:0,z:0},900);}
  }
  function resizeGraph(){if(graph3D&&graphMode==='3d'){const host=$('#proposal-network-3d');graph3D.width(host.clientWidth||800).height(host.clientHeight||650);}}
  function render2D() {
    const host=$('#proposal-network-2d');if(!host||graphMode!=='2d')return;
    const selected=courseById.get(focusedCourse);
    if(!selected){host.innerHTML=`<div class="proposal-network-overview"><h3>Red curricular completa</h3><p>Hay ${courses.length} asignaturas conectadas con ${raList.length} resultados, sus competencias, indicadores y componentes del perfil; las secuencias se articulan mediante diez cadenas cognitivas.</p>${data.chains.map(c=>`<button class="proposal-chain-chip" data-chain-focus="${c.id}">${esc(c.id)} · ${esc(c.name)}</button>`).join('')}</div>`;return;}
    const neighbors=new Map();for(const chain of data.chains){const i=chain.courseIds.indexOf(selected.id);for(const j of [i-1,i+1])if(chain.courseIds[j])neighbors.set(chain.courseIds[j],courseById.get(chain.courseIds[j]));}
    const mapped=raList.map((ra,i)=>({ra,level:selected[ra.id.toLowerCase()],comp:data.competencies[i],indicator:data.indicators[i],profile:data.profile[i]})).filter(x=>x.level);
    const width=2200,height=1400,centerX=1100,centerY=765;
    const wrap=(text,max=26)=>{const words=String(text).split(/\s+/),out=[];let line='';for(const word of words){if(line&&(`${line} ${word}`).length>max){out.push(line);line=word;}else line=line?`${line} ${word}`:word;}if(line)out.push(line);return out;};
    const card=(x,y,w,h,title,sub='',kind='course',id='')=>{const lines=wrap(title,kind==='course'?30:34),boxH=Math.max(h,lines.length*14+38),label=lines.map((t,i)=>`<tspan x="0" dy="${i?14:0}">${esc(t)}</tspan>`).join(''),cls=`mindmap-node mindmap-node--${kind}`;return `<g class="${cls}" transform="translate(${x} ${y})" ${id?`data-v20-focus="${esc(id)}" tabindex="0" role="button"`:''}><title>${esc(title)} · ${esc(sub)}</title><rect x="${-w/2}" y="${-boxH/2}" width="${w}" height="${boxH}" rx="13"/><text class="mindmap-code" y="${-boxH/2+18}" text-anchor="middle">${esc(sub)}</text><text class="mindmap-label" y="${-((lines.length-1)*7)}" text-anchor="middle">${label}</text></g>`;};
    const line=(x1,y1,x2,y2,color='#68879b',dash='')=>`<path d="M${x1} ${y1} C ${(x1+x2)/2} ${y1}, ${(x1+x2)/2} ${y2}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2.5" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
    const nodes=[],edges=[];
    mapped.forEach((x,i)=>{const xPos=centerX-(mapped.length-1)*250/2+i*250;nodes.push(card(xPos,125,228,132,x.comp.name,'COMPETENCIA','competencia'));edges.push(line(xPos,190,xPos,250,'#ad843c'));nodes.push(card(xPos,325,228,146,x.ra.name,`${x.ra.id} · ${levelName(x.level)}`,'ra'));edges.push(line(xPos,398,xPos,485,'#258b8d'));nodes.push(card(xPos,565,228,126,x.indicator.description,x.indicator.name,'indicador'));edges.push(line(xPos,628,centerX,centerY-55,'#a35f93'));nodes.push(card(xPos,1110,230,180,x.profile.category,'PERFIL DE EGRESO','perfil'));edges.push(line(centerX,centerY+60,xPos,1018,'#a35f93'));});
    nodes.push(card(centerX,centerY,300,116,selected.name,`Semestre ${selected.semester} · ${selected.credits} créditos`,'course',selected.id));
    const neighborList=[...neighbors.values()];neighborList.forEach((c,i)=>{const side=c.semester<selected.semester?'left':'right',items=neighborList.filter(n=>(n.semester<selected.semester)===(side==='left')),idx=items.indexOf(c),x=side==='left'?150:2050,y=520+idx*145;nodes.push(card(x,y,300,104,c.name,`Semestre ${c.semester} · cadena`,'course',c.id));edges.push(line(side==='left'?x+150:centerX+150,y,side==='left'?centerX-150:x-150,centerY,'#426e9d'));});
    const headings=`<g class="mindmap-headings"><text x="1100" y="35" text-anchor="middle">COMPETENCIAS DEL PERFIL</text><text x="1100" y="230" text-anchor="middle">RESULTADOS DE APRENDIZAJE</text><text x="1100" y="465" text-anchor="middle">INDICADORES</text><text x="1100" y="1000" text-anchor="middle">PERFIL DE EGRESO</text><text x="150" y="430" text-anchor="middle">ASIGNATURAS PREVIAS</text><text x="2050" y="430" text-anchor="middle">ASIGNATURAS QUE CONTINÚAN</text></g>`;
    host.innerHTML=`<svg class="mindmap-svg proposal-mindmap-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Interconexión curricular de ${esc(selected.name)}"><g class="proposal-map-world">${headings}${edges.join('')}${nodes.join('')}</g></svg>`;
    const world=$('.proposal-map-world',host);world.setAttribute('transform',`translate(${width*(1-graphZoom)/2} ${height*(1-graphZoom)/2}) scale(${graphZoom})`);
    host.onwheel=(e)=>{e.preventDefault();graphZoom=Math.max(.55,Math.min(2.2,graphZoom*(e.deltaY<0?1.08:1/1.08)));const g=$('.proposal-map-world',host);g?.setAttribute('transform',`translate(${width*(1-graphZoom)/2} ${height*(1-graphZoom)/2}) scale(${graphZoom})`);};
  }
  function renderNetworkControls(){
    const select=$('#proposal-network-subject'),previous=select.value;select.innerHTML='<option value="">Red completa</option>'+courses.map(c=>`<option value="${c.id}">Semestre ${c.semester} · ${esc(c.name)}</option>`).join('');select.value=courseById.has(previous)?previous:'';
  }
  function renderAll(){renderDashboard();renderUpload();renderResults();renderCourses();renderChains();renderNetworkControls();}

  $('#program-selector').addEventListener('change',e=>{
    const proposal=e.target.value==='v20';$('#vigente-sidebar').hidden=proposal;$('#main').hidden=proposal;$('#proposal-sidebar').hidden=!proposal;$('#proposal-main').hidden=!proposal;document.querySelector('.skip-link').href=proposal?'#proposal-main':'#main';
    if(proposal){renderAll();switchView('proposal-inicio');requestAnimationFrame(()=>{resizeGraph();});}
    else if(graph3D){graph3D.pauseAnimation();}
  });
  $$('.proposal-sidebar .nav-item[data-proposal-view]').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.proposalView)));
  $$('[data-proposal-nav]').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.proposalNav)));
  $('#proposal-period').addEventListener('change',e=>$('#proposal-custom-period-wrap').hidden=e.target.value!=='otro');
  $('#proposal-file-input').addEventListener('change',async e=>{
    const files=[...e.target.files];if(!files.length)return;
    const choice=$('#proposal-period').value,period=choice==='otro'?$('#proposal-custom-period').value.trim():choice;
    if(!period){alert('Seleccione o escriba el periodo académico antes de cargar.');e.target.value='';return;}
    try{
      const incoming=[];
      for(const file of files){const parsed=parseCsv(await file.text());const rows=parsed.map(r=>({...r,periodo:period,sourceFile:file.name}));const val=rows.filter(r=>status(r)==='VÁLIDA').length;incoming.push({file:file.name,period,total:rows.length,valid:val,omitted:rows.length-val,rows});}
      const append=$('#proposal-import-mode').value==='append';
      state.rows=append?[...state.rows,...incoming.flatMap(x=>x.rows)]:incoming.flatMap(x=>x.rows);
      state.uploads=append?[...state.uploads,...incoming.map(({rows,...x})=>x)]:incoming.map(({rows,...x})=>x);
      save();e.target.value='';switchView('proposal-cargas');
    } catch(err){alert(err.message);}
  });
  $('#proposal-template').addEventListener('click',()=>{
    const rows=[['asignatura','estudiante','actividad','codigo_actividad','instrumento','nota'],[courses[0].name,'Nombre Apellido','Taller de valoración','','Rúbrica del curso','4.2'],[courses[1].name,'Nombre Apellido','Examen parcial','','Examen escrito','3.8']];
    const csv=rows.map(r=>r.map(escapeCsvCell).join(';')).join('\r\n');download('plantilla_carga_notas_fisioterapia_v20.csv','\uFEFF'+csv,'text/csv;charset=utf-8');
  });
  $('#proposal-clear').addEventListener('click',()=>{if(confirm('¿Eliminar del navegador las notas y periodos cargados para la propuesta V20?')){state=freshState();save();}});
  $('#proposal-chart-period').addEventListener('change',drawProposalChart);$('#proposal-table-period').addEventListener('change',drawProposalTableChart);
  $('#proposal-chart-metric').addEventListener('change',drawProposalChart);$('#proposal-table-metric').addEventListener('change',drawProposalTableChart);
  $('#proposal-student').addEventListener('change',drawStudentChart);$('#proposal-student-period').addEventListener('change',drawStudentChart);
  $('#proposal-export-csv').addEventListener('click',()=>{const header=['Periodo','Semestre','RA','Aporte ponderado','Aporte por créditos','Comparable por créditos','Evidencias válidas','Factor promedio'];const csv=[header,...results().map(r=>[r.period,r.semester,r.ra,r.direct.toFixed(2),r.credit?.toFixed(2)??'',r.comparable?.toFixed(2)??'',r.count,r.averageFactor.toFixed(2)])].map(row=>row.map(escapeCsvCell).join(';')).join('\r\n');download('CORA-fisioterapia-propuesta-V20-resultados.csv','\uFEFF'+csv,'text/csv;charset=utf-8');});
  $('#proposal-course-search').addEventListener('input',renderCourses);
  $('#proposal-network-subject').addEventListener('change',e=>setFocusedCourse(e.target.value));
  $$('[data-v20-network-view]').forEach(btn=>btn.addEventListener('click',()=>{graphMode=btn.dataset.v20NetworkView;$$('[data-v20-network-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));const stage=$('.proposal-network-stage');stage.dataset.v20View=graphMode;$('#proposal-network-3d').hidden=graphMode!=='3d';$('#proposal-network-2d').hidden=graphMode!=='2d';if(graphMode==='3d')render3D();else render2D();}));
  const proposalMap=$('#proposal-network-2d');
  proposalMap.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType!=='touch')return;proposalPanStart={x:e.clientX,y:e.clientY,left:proposalMap.scrollLeft,top:proposalMap.scrollTop};proposalPanMoved=false;proposalMap.classList.add('is-panning');proposalMap.setPointerCapture?.(e.pointerId);});
  proposalMap.addEventListener('pointermove',e=>{if(!proposalPanStart)return;const dx=e.clientX-proposalPanStart.x,dy=e.clientY-proposalPanStart.y;if(Math.abs(dx)+Math.abs(dy)>4)proposalPanMoved=true;if(proposalPanMoved){proposalMap.scrollLeft=proposalPanStart.left-dx;proposalMap.scrollTop=proposalPanStart.top-dy;}});
  ['pointerup','pointercancel'].forEach(type=>proposalMap.addEventListener(type,()=>{proposalPanStart=null;proposalMap.classList.remove('is-panning');}));
  document.addEventListener('click',e=>{if(proposalPanMoved){proposalPanMoved=false;return;}const focus=e.target.closest('[data-v20-focus]');if(focus){$('#program-selector').value='v20';$('#vigente-sidebar').hidden=true;$('#main').hidden=true;$('#proposal-sidebar').hidden=false;$('#proposal-main').hidden=false;switchView('proposal-interconexion');setFocusedCourse(focus.dataset.v20Focus);return;}const chip=e.target.closest('[data-chain-focus]');if(chip){const chain=data.chains.find(x=>x.id===chip.dataset.chainFocus),id=chain?.courseIds[0];if(id)setFocusedCourse(id);}});
  window.addEventListener('resize',resizeGraph,{passive:true});
  renderAll();
})();
