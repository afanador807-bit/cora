/* Medición criterial y triangulación aisladas para la propuesta V20. */
(() => {
  const data = window.CORA_FISIO_V20, core = window.CORA_CriterialCore;
  if (!data || !core || !document.querySelector('#proposal-criterial')) return;
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  const hnorm = value => core.normalize(value).replace(/[^a-z0-9]/g, '');
  const KEY = 'cora-fisioterapia-propuesta-v20-evidencia-v1';
  const defaultConfig = () => ({
    bands: [{id:'BAJO',label:'Bajo',min:0,max:2.99},{id:'MEDIO',label:'Medio',min:3,max:3.99},{id:'ALTO',label:'Alto',min:4,max:4.49},{id:'SUPERIOR',label:'Superior',min:4.5,max:5}],
    thresholds: { INTRODUCE:3, REFUERZA:3.5, DOMINA:4 },
    minimumN:5, margin:10, divergenceTolerance:15, saberProMinimumLevel:3,
    kpis: Object.fromEntries(data.profile.map((profile,index)=>[profile.indicator,{ra:profile.ra,minimumBand:index===0?'ALTO':'MEDIO',target:80,scope:'domina'}])),
    raTargets: Object.fromEntries(data.ra.map(ra=>[ra.id,80])),
    modules: [
      {module:'Lectura crítica',ras:['RA2'],cut2:'',cut3:'',cut4:''},
      {module:'Razonamiento cuantitativo',ras:['RA2'],cut2:'',cut3:'',cut4:''},
      {module:'Competencias ciudadanas',ras:['RA3','RA4'],cut2:'',cut3:'',cut4:''},
      {module:'Comunicación escrita',ras:['RA5'],cut2:'',cut3:'',cut4:''},
      {module:'Inglés',ras:['RA5'],cut2:'',cut3:'',cut4:''}
    ],
    items: Object.fromEntries(data.ra.map(ra=>[ra.id,[
      `Me siento capaz de ${ra.description.charAt(0).toLowerCase()+ra.description.slice(1)}`,
      `Puedo demostrar de manera autónoma este resultado: ${ra.description}`
    ]]))
  });
  const defaultState = () => ({ curricularVersion:data.metadata.version, approved:false, config:defaultConfig(), sources:{ saberPro:[], perception:[], stakeholders:[] }, imports:{ saberPro:[], perception:[], stakeholders:[] } });
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { saved = null; }
  let state = core.migrateState(saved, defaultState());
  if (state.curricularVersion !== data.metadata.version) state = defaultState();
  if (core.validateConfig(state.config)) state.approved = false;
  let selectedRAs = new Set(data.ra.map(ra=>ra.id));

  function persist() { localStorage.setItem(KEY,JSON.stringify(state)); renderAll(); }
  function csvEscape(value) { return '"'+String(value??'').replace(/"/g,'""')+'"'; }
  function download(name,content,type) { const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200); }
  function noteRows() { try { return JSON.parse(localStorage.getItem('cora-fisioterapia-propuesta-v20-v1'))?.rows || []; } catch { return []; } }
  function criterionRows(options={}) { return core.computeCriterial({rows:noteRows(),subjects:data.subjects,raList:data.ra,config:state.config,...options}); }
  function compareFilters(row) { return (!$('#v20-criteria-period').value||row.period===$('#v20-criteria-period').value)&&(!$('#v20-criteria-semester').value||String(row.semester)===$('#v20-criteria-semester').value)&&selectedRAs.has(row.ra); }
  function rankBand(band) { return core.BAND_ORDER.indexOf(band); }
  function pct(n,d) { return d?100*n/d:null; }
  function fmt(value,digits=2) { return value==null||!Number.isFinite(Number(value))?'—':Number(value).toFixed(digits); }
  function activeSettingsNotice() {
    const message=state.approved?'Configuración marcada como aprobada por el comité curricular.':'Valor provisional sujeto a aprobación del comité curricular.';
    ['#v20-config-status','#v20-government-status','#v20-evidence-config-status'].forEach(selector=>{const target=$(selector);if(target)target.textContent=message;});
  }
  function renderConfig() {
    const cfg=state.config;
    $('#v20-config-fields').innerHTML=`
      <fieldset class="v20-config-set"><legend>Bandas de desempeño · escala institucional 0 a 5</legend><div class="table-wrap"><table><thead><tr><th>Banda</th><th>Desde</th><th>Hasta</th></tr></thead><tbody>${cfg.bands.map((band,index)=>`<tr><th>${esc(band.label)}</th><td><input type="number" min="0" max="5" step="0.01" data-band="${index}" data-bound="min" value="${esc(band.min)}" aria-label="Límite inferior de ${esc(band.label)}"></td><td><input type="number" min="0" max="5" step="0.01" data-band="${index}" data-bound="max" value="${esc(band.max)}" aria-label="Límite superior de ${esc(band.label)}"></td></tr>`).join('')}</tbody></table></div></fieldset>
      <fieldset class="v20-config-set"><legend>Umbral de nivel esperado según aporte</legend><div class="v20-config-grid">${[['INTRODUCE','Introduce'],['REFUERZA','Refuerza'],['DOMINA','Domina']].map(([key,label])=>`<label>${label}<input type="number" min="0" max="5" step="0.01" data-threshold="${key}" value="${esc(cfg.thresholds[key])}"></label>`).join('')}</div></fieldset>
      <fieldset class="v20-config-set"><legend>Indicadores de logro · relación RA–KPI del perfil</legend><div class="v20-kpi-config">${data.profile.map(profile=>{const indicator=data.indicators.find(x=>x.id===profile.indicator),kpi=cfg.kpis[profile.indicator];return `<article class="v20-kpi-config__item"><strong>${esc(profile.indicator)} → ${esc(profile.ra)} · ${esc(indicator?.description||'Indicador')}</strong><label>Banda mínima<select data-kpi="${profile.indicator}" data-field="minimumBand">${cfg.bands.map(b=>`<option value="${b.id}"${kpi.minimumBand===b.id?' selected':''}>${esc(b.label)} o superior</option>`).join('')}</select></label><label>Meta (%)<input type="number" min="0" max="100" step="1" data-kpi="${profile.indicator}" data-field="target" value="${esc(kpi.target)}"></label><label>Alcance<select data-kpi="${profile.indicator}" data-field="scope"><option value="all"${kpi.scope==='all'?' selected':''}>Todas las asignaturas con aporte al RA</option><option value="domina"${kpi.scope==='domina'?' selected':''}>Solo asignaturas en nivel Domina</option><option value="practica"${kpi.scope==='practica'?' selected':''}>Solo asignaturas de naturaleza práctica</option></select></label></article>`;}).join('')}</div></fieldset>
      <fieldset class="v20-config-set"><legend>Estabilidad y comparación</legend><div class="v20-config-grid"><label>Tamaño mínimo de muestra<input type="number" min="1" step="1" data-global="minimumN" value="${esc(cfg.minimumN)}"></label><label>Margen del semáforo (puntos porcentuales)<input type="number" min="0" max="100" step="1" data-global="margin" value="${esc(cfg.margin)}"></label><label>Tolerancia de convergencia (puntos porcentuales)<input type="number" min="0" max="100" step="1" data-global="divergenceTolerance" value="${esc(cfg.divergenceTolerance)}"></label><label>Nivel mínimo de Saber Pro (1–4)<input type="number" min="1" max="4" step="1" data-global="saberProMinimumLevel" value="${esc(cfg.saberProMinimumLevel)}"></label></div><p class="muted">Con n inferior al mínimo, la vista criterial muestra “estimación inestable”; egresados y empleadores no muestran el porcentaje hasta alcanzar ese tamaño.</p></fieldset>
      <fieldset class="v20-config-set"><legend>Metas de triangulación por RA</legend><div class="v20-config-grid">${data.ra.map(ra=>`<label>${esc(ra.id)} · meta (%)<input type="number" min="0" max="100" step="1" data-ra-target="${ra.id}" value="${esc(cfg.raTargets[ra.id]??80)}"></label>`).join('')}</div></fieldset>`;
    $('#v20-config-approved').checked=Boolean(state.approved);activeSettingsNotice();
  }

  function collectConfig() {
    const cfg=structuredClone(state.config);
    document.querySelectorAll('#v20-config-fields [data-band]').forEach(input=>{cfg.bands[Number(input.dataset.band)][input.dataset.bound]=Number(input.value);});
    document.querySelectorAll('#v20-config-fields [data-threshold]').forEach(input=>{cfg.thresholds[input.dataset.threshold]=Number(input.value);});
    document.querySelectorAll('#v20-config-fields [data-kpi]').forEach(input=>{const item=cfg.kpis[input.dataset.kpi];item[input.dataset.field]=input.dataset.field==='target'?Number(input.value):input.value;});
    document.querySelectorAll('#v20-config-fields [data-global]').forEach(input=>{cfg[input.dataset.global]=Number(input.value);});
    document.querySelectorAll('#v20-config-fields [data-ra-target]').forEach(input=>{cfg.raTargets[input.dataset.raTarget]=Number(input.value);});
    return cfg;
  }

  function renderFilters(rows) {
    const period=$('#v20-criteria-period'),oldPeriod=period.value,periods=[...new Set(rows.map(r=>r.period))].sort();
    period.innerHTML='<option value="">Todos</option>'+periods.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');period.value=periods.includes(oldPeriod)?oldPeriod:'';
    const semester=$('#v20-criteria-semester'),oldSemester=semester.value,semesters=[...new Set(rows.map(r=>String(r.semester)))].sort((a,b)=>Number(a)-Number(b));
    semester.innerHTML='<option value="">Todos</option>'+semesters.map(x=>`<option value="${esc(x)}">Semestre ${esc(x)}</option>`).join('');semester.value=semesters.includes(oldSemester)?oldSemester:'';
    $('#v20-criteria-ra-filter').innerHTML=data.ra.map(ra=>`<label class="ra-chart-toggle"><input type="checkbox" value="${ra.id}"${selectedRAs.has(ra.id)?' checked':''}>${esc(ra.id)}</label>`).join('');
  }

  function baseGroups(rows) {
    const groups=new Map();
    for(const row of rows){const key=[row.period,row.semester,row.ra].join('|'),item=groups.get(key)||{period:row.period,semester:row.semester,ra:row.ra,rows:[]};item.rows.push(row);groups.set(key,item);}
    return [...groups.values()].map(group=>{
      const values=group.rows.map(x=>x.score),stats=core.stats(values),totalEvidence=group.rows.reduce((sum,x)=>sum+x.evidenceCount,0),threshold=group.rows.reduce((sum,x)=>sum+x.threshold,0)/group.rows.length,byBand=Object.fromEntries(core.BAND_ORDER.map(b=>[b,group.rows.filter(x=>x.band===b).length]));
      return {...group,stats,evidenceCount:totalEvidence,threshold,successCount:group.rows.filter(x=>x.achieves).length,successPct:pct(group.rows.filter(x=>x.achieves).length,group.rows.length),byBand};
    }).sort((a,b)=>a.period.localeCompare(b.period)||Number(a.semester)-Number(b.semester)||a.ra.localeCompare(b.ra));
  }

  function renderKpiCards() {
    const cards=[];
    for(const profile of data.profile){
      const kpi=data.indicators.find(x=>x.id===profile.indicator),cfg=state.config.kpis[profile.indicator];
      if(!selectedRAs.has(profile.ra))continue;
      const rows=criterionRows({period:$('#v20-criteria-period').value,semester:$('#v20-criteria-semester').value,ra:profile.ra,scope:cfg.scope});
      const grouped=new Map();for(const row of rows){const key=[row.period,row.semester].join('|'),item=grouped.get(key)||{period:row.period,semester:row.semester,rows:[]};item.rows.push(row);grouped.set(key,item);}
      for(const group of grouped.values()){
        const count=group.rows.filter(row=>rankBand(row.band)>=rankBand(cfg.minimumBand)).length,percent=pct(count,group.rows.length),evidence=group.rows.reduce((sum,row)=>sum+row.evidenceCount,0),gap=percent==null?null:cfg.target-percent;
        const signal=gap==null?'sin-datos':gap<=0?'verde':gap<=state.config.margin?'amarillo':'rojo';
        const traces=group.rows.flatMap(row=>row.records.map(ref=>({row:ref.row,line:ref.row.line??ref.index+1,score:ref.row.nota,course:ref.row.asignatura,student:ref.row.estudiante})));
        cards.push(`<article class="v20-kpi-card v20-kpi-card--${signal}"><p class="eyebrow">${esc(profile.indicator)} · ${esc(profile.ra)} · ${esc(group.period)} · Semestre ${esc(group.semester)}</p><h4>${esc(kpi?.description||kpi?.name||profile.indicator)}</h4><div class="v20-kpi-card__metric"><strong>${percent==null?'—':percent.toFixed(1)+'%'}</strong><span>Meta ${fmt(cfg.target,0)}% · mínimo ${esc(cfg.minimumBand.toLowerCase())} o superior</span></div><p>${count} de ${group.rows.length} estudiantes · ${evidence} evidencias válidas · alcance: ${cfg.scope==='domina'?'asignaturas Domina':cfg.scope==='practica'?'naturaleza práctica':'todas las asignaturas con aporte'}</p>${group.rows.length<state.config.minimumN?'<p class="v20-unstable">Estimación inestable: n inferior al mínimo configurado.</p>':''}<div class="v20-signal" aria-label="Semáforo ${signal}"><i></i>${signal==='verde'?'Meta alcanzada':signal==='amarillo'?'Dentro del margen configurado':signal==='rojo'?'Por debajo de la meta':'Sin datos suficientes'}</div><details><summary>Ver trazabilidad de ${traces.length} registros</summary><div class="table-wrap"><table><thead><tr><th>Estudiante</th><th>Asignatura</th><th>Nota</th><th>Periodo</th><th>Fila</th></tr></thead><tbody>${traces.map(t=>`<tr><td>${esc(t.student)}</td><td>${esc(t.course)}</td><td>${esc(t.score)}</td><td>${esc(t.row.periodo||group.period)}</td><td>${esc(t.line)}</td></tr>`).join('')||'<tr><td colspan="5">Sin registros de trazabilidad.</td></tr>'}</tbody></table></div></details></article>`);
      }
    }
    $('#v20-kpi-cards').innerHTML=cards.join('')||'<p class="muted">No hay grupos criteriales para los filtros elegidos.</p>';
  }

  function filteredAllRows() { return criterionRows().filter(compareFilters); }
  function renderDistribution(groups) {
    const target=$('#v20-band-distribution');if(!groups.length){target.innerHTML='<p class="muted">No hay estudiantes en los cortes seleccionados.</p>';return;}
    const width=Math.max(760,groups.length*155+100),height=300,left=58,right=24,top=24,bottom=82,plotW=width-left-right,plotH=height-top-bottom,colors={BAJO:'#b45b53',MEDIO:'#c7a34b',ALTO:'#488673',SUPERIOR:'#315c89'};
    let svg=`<svg class="v20-svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Distribución porcentual de estudiantes por banda criterial"><title>Distribución por bandas de desempeño, n indicado sobre cada barra</title>`;
    for(const v of [0,25,50,75,100]){const y=top+plotH*(1-v/100);svg+=`<line class="gridline" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text class="axis-label" x="${left-8}" y="${y+4}" text-anchor="end">${v}%</text>`;}
    const slot=plotW/groups.length,barW=Math.min(54,slot*.44);
    groups.forEach((group,index)=>{const x=left+slot*(index+.5)-barW/2;let y=top+plotH;for(const band of core.BAND_ORDER){const count=group.byBand[band],h=group.rows.length?plotH*count/group.rows.length:0;y-=h;if(h>0)svg+=`<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${colors[band]}"><title>${esc(band)}: ${count} de ${group.rows.length} (${(100*count/group.rows.length).toFixed(1)}%)</title></rect>`;}const label=`${group.period} · S${group.semester} · ${group.ra}`;svg+=`<text class="axis-label" x="${x+barW/2}" y="${top-6}" text-anchor="middle">n=${group.rows.length}</text><text class="axis-label x-label" x="${x+barW/2}" y="${height-50}" text-anchor="middle">${esc(group.period)}</text><text class="axis-label x-label" x="${x+barW/2}" y="${height-34}" text-anchor="middle">S${esc(group.semester)} · ${esc(group.ra)}</text>`;});
    svg+='</svg><div class="v20-chart-legend">'+core.BAND_ORDER.map(b=>`<span><i style="background:${colors[b]}"></i>${b[0]+b.slice(1).toLowerCase()}</span>`).join('')+'</div>';target.innerHTML=svg;
  }

  function renderBoxplot(groups) {
    const target=$('#v20-boxplot');if(!groups.length){target.innerHTML='<p class="muted">No hay datos suficientes para construir los diagramas de caja.</p>';return;}
    const width=Math.max(760,groups.length*145+100),height=350,left=58,right=24,top=28,bottom=78,plotW=width-left-right,plotH=height-top-bottom,y=v=>top+plotH*(1-Math.max(0,Math.min(5,v))/5),colors={RA1:'#0f5c76',RA2:'#0b7a75',RA3:'#9b6041',RA4:'#715b9b',RA5:'#a0456a'};
    let svg=`<svg class="v20-svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Diagramas de caja de notas criteriales por semestre y RA"><title>Cajas con mínimo, cuartil uno, mediana, cuartil tres y máximo; umbral esperado con línea discontinua</title>`;
    for(let v=0;v<=5;v++){svg+=`<line class="gridline" x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}"/><text class="axis-label" x="${left-8}" y="${y(v)+4}" text-anchor="end">${v}</text>`;}
    const slot=plotW/groups.length,boxW=Math.min(32,slot*.36);
    groups.forEach((group,index)=>{const cx=left+slot*(index+.5),q1=core.quantile(group.rows.map(r=>r.score),.25),med=core.quantile(group.rows.map(r=>r.score),.5),q3=core.quantile(group.rows.map(r=>r.score),.75),min=Math.min(...group.rows.map(r=>r.score)),max=Math.max(...group.rows.map(r=>r.score)),col=colors[group.ra]||'#526779';svg+=`<line x1="${cx}" y1="${y(min)}" x2="${cx}" y2="${y(max)}" stroke="${col}"/><line x1="${cx-boxW/3}" y1="${y(min)}" x2="${cx+boxW/3}" y2="${y(min)}" stroke="${col}"/><line x1="${cx-boxW/3}" y1="${y(max)}" x2="${cx+boxW/3}" y2="${y(max)}" stroke="${col}"/><rect x="${cx-boxW/2}" y="${y(q3)}" width="${boxW}" height="${Math.max(1,y(q1)-y(q3))}" fill="${col}" fill-opacity=".28" stroke="${col}"><title>${esc(group.ra)} · ${esc(group.period)} · S${group.semester}: mín ${fmt(min)}, Q1 ${fmt(q1)}, mediana ${fmt(med)}, Q3 ${fmt(q3)}, máx ${fmt(max)}</title></rect><line x1="${cx-boxW/2}" y1="${y(med)}" x2="${cx+boxW/2}" y2="${y(med)}" stroke="${col}" stroke-width="2"/><line x1="${cx-26}" y1="${y(group.threshold)}" x2="${cx+26}" y2="${y(group.threshold)}" stroke="#252a37" stroke-width="2" stroke-dasharray="4 3"><title>Umbral esperado ${fmt(group.threshold)}</title></line><text class="axis-label" x="${cx}" y="${height-48}" text-anchor="middle">${esc(group.period)}</text><text class="axis-label" x="${cx}" y="${height-31}" text-anchor="middle">S${group.semester} · ${esc(group.ra)}</text>`;});
    svg+='</svg><p class="muted">Línea discontinua: umbral esperado promedio ponderado por créditos. Colores: RA1–RA5.</p>';target.innerHTML=svg;
  }

  function renderAudit(groups) {
    $('#v20-criteria-audit').innerHTML=groups.length?groups.map(g=>{const bands=core.BAND_ORDER.map(b=>`${b[0]+b.slice(1).toLowerCase()}: ${fmt(pct(g.byBand[b],g.rows.length),1)}%`).join(' · ');return `<tr><td>${esc(g.period)}</td><td>${esc(g.semester)}</td><td>${esc(g.ra)}</td><td>${g.rows.length}</td><td>${g.evidenceCount}</td><td>${fmt(g.stats.mean)}</td><td>${fmt(g.stats.sd)}</td><td>${fmt(g.stats.median)}</td><td>${fmt(g.stats.q3-g.stats.q1)}</td><td>${fmt(g.threshold)}</td><td>${fmt(g.successPct,1)}%${g.rows.length<state.config.minimumN?'<small class="v20-unstable"> · estimación inestable</small>':''}</td><td>${bands}</td></tr>`;}).join(''):'<tr><td colspan="12" class="muted">No hay registros válidos para auditar.</td></tr>';
  }

  function renderStudentCriteria() {
    const table=$('#v20-student-criterial');if(!table)return;
    const selectedStudent=$('#proposal-student')?.value||'',selectedPeriod=$('#proposal-student-period')?.value||'';
    const rows=criterionRows().filter(row=>(!selectedStudent||row.student===selectedStudent)&&(!selectedPeriod||row.period===selectedPeriod)).sort((a,b)=>a.period.localeCompare(b.period)||Number(a.semester)-Number(b.semester)||a.ra.localeCompare(b.ra));
    table.innerHTML=rows.length?rows.map(row=>`<tr><td>${esc(row.period)}</td><td>${esc(row.semester)}</td><td>${esc(row.ra)}</td><td>${fmt(row.score)}</td><td>${fmt(row.threshold)}</td><td><span class="badge v20-band v20-band--${row.band.toLowerCase()}">${esc(row.band)}</span></td><td>${row.achieves?'Logra':'Aún no logra'}</td></tr>`).join(''):'<tr><td colspan="7" class="muted">Seleccione un estudiante o cargue registros válidos para calcular su trayectoria criterial.</td></tr>';
  }

  function renderCriteria() {
    const all=criterionRows();renderFilters(all);
    const rows=all.filter(compareFilters),groups=baseGroups(rows);
    renderKpiCards();renderDistribution(groups);renderBoxplot(groups);renderAudit(groups);renderStudentCriteria();
  }

  function parseCsv(text) {
    const source=String(text).replace(/^\uFEFF/,'');let delimiter=',',quoted=false,counts={',':0,';':0,'\t':0},first=source.split(/\r?\n/,1)[0]||'';
    for(let i=0;i<first.length;i++){if(first[i]==='"'){if(quoted&&first[i+1]==='"'){i++;continue;}quoted=!quoted;}else if(!quoted&&Object.hasOwn(counts,first[i]))counts[first[i]]++;}
    delimiter=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];const table=[];let row=[],field='',inQuotes=false;
    for(let i=0;i<source.length;i++){const ch=source[i];if(ch==='"'&&inQuotes&&source[i+1]==='"'){field+='"';i++;}else if(ch==='"')inQuotes=!inQuotes;else if(ch===delimiter&&!inQuotes){row.push(field);field='';}else if((ch==='\n'||ch==='\r')&&!inQuotes){if(ch==='\r'&&source[i+1]==='\n')i++;row.push(field);if(row.some(cell=>cell.trim()))table.push(row);row=[];field='';}else field+=ch;}
    if(field||row.length){row.push(field);table.push(row);}return table.length?{headers:table[0].map(hnorm),rows:table.slice(1)}:{headers:[],rows:[]};
  }
  function headerIndex(headers,...keys){return headers.findIndex(h=>keys.includes(h));}
  function cell(row,index){return index<0?'':String(row[index]??'').trim();}
  function qualityRows(source) {
    const dataRows=state.sources[source],valid=dataRows.filter(x=>x._status==='VÁLIDA').length,unclassified=source==='saberPro'?dataRows.filter(x=>x._status==='VÁLIDA'&&!classifySaber(x)).length:0;
    const privacy=dataRows.some(x=>x._privacyWarning);
    const warn=privacy?(source==='stakeholders'?' El archivo contiene identificadores personales; elimínalos. Esta fuente no debe incluir identificadores (Ley 1581 de 2012).':' El encabezado contiene campo de nombre: reemplázalo por código de estudiante según la Ley 1581 de 2012.') :'';
    const noClass=unclassified?` ${unclassified} filas válidas no tienen nivel ni puntos de corte y se excluyen de porcentajes.`:'';
    const target=$(`#v20-${source==='saberPro'?'saber':source==='perception'?'perception':'stakeholders'}-quality`);
    target.textContent=`${valid} válidas · ${dataRows.length-valid} excluidas de ${dataRows.length}.${noClass}${warn}`;
    target.classList.toggle('notice--warning',Boolean(warn||unclassified));
    const host=$(`#v20-${source==='saberPro'?'saber':source==='perception'?'perception':'stakeholders'}-rows`);
    host.innerHTML=dataRows.length?`<table><thead><tr><th>Fila</th><th>Periodo</th><th>RA / módulo</th><th>Valor</th><th>Estado</th></tr></thead><tbody>${dataRows.slice(-12).reverse().map(row=>`<tr><td>${row._line}</td><td>${esc(row.periodo||row.periodo_aplicacion||'')}</td><td>${esc(row.ra||row.modulo||'')}</td><td>${esc(row.nota??row.puntaje??row.respuesta??'')}</td><td>${esc(row._status)}${row._status==='VÁLIDA'&&source==='saberPro'&&!classifySaber(row)?' · Sin clasificación':''}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Aún no hay filas cargadas para esta fuente.</p>';
  }

  function classifySaber(row) {
    const explicit=Number(row.nivel_desempeno);if(Number.isInteger(explicit)&&explicit>=1&&explicit<=4)return explicit;
    const module=state.config.modules.find(item=>hnorm(item.module)===hnorm(row.modulo));if(!module)return null;
    if([module.cut2,module.cut3,module.cut4].some(value=>String(value??'').trim()===''))return null;
    const score=Number(row.puntaje),cut2=Number(module.cut2),cut3=Number(module.cut3),cut4=Number(module.cut4);
    if(!Number.isFinite(score)||![cut2,cut3,cut4].every(Number.isFinite))return null;
    if(!(cut2<=cut3&&cut3<=cut4))return null;
    return score>=cut4?4:score>=cut3?3:score>=cut2?2:1;
  }

  function sourceParser(source,text,fileName) {
    const parsed=parseCsv(text),h=parsed.headers,records=parsed.rows;
    const nameWarning=h.some(x=>source==='stakeholders'?/^(nombre|nombres|name|studentname|nombrecompleto|codigoestudiante|identificacion|documento|correo|email|telefono)$/.test(x):/^(nombre|nombres|name|studentname|nombrecompleto)$/.test(x));
    if(!records.length)throw Error('El archivo no contiene filas de datos.');
    const pick=(...names)=>headerIndex(h,...names);
    return records.map((cells,index)=>{
      const base={_line:index+2,_file:fileName,_privacyWarning:nameWarning};let error='';
      if(source==='saberPro'){
        const row={...base,codigo_estudiante:cell(cells,pick('codigoestudiante','codigo','codigodeestudiante')),periodo_aplicacion:cell(cells,pick('periodoaplicacion','periodo','periodoacademico')),modulo:cell(cells,pick('modulo')),puntaje:cell(cells,pick('puntaje','score')),nivel_desempeno:cell(cells,pick('niveldedesempeno','nivel')),percentil:cell(cells,pick('percentil')),media_grupo_referencia:cell(cells,pick('mediagruporeferencia','mediagrupo'))};
        const score=Number(row.puntaje),level=row.nivel_desempeno===''?null:Number(row.nivel_desempeno);
        if(!row.codigo_estudiante||!row.periodo_aplicacion||!row.modulo||row.puntaje===''||!Number.isFinite(score)||score<0||score>300)error='Código, periodo, módulo y puntaje (0–300) son obligatorios';
        if(!error&&level!==null&&(!Number.isInteger(level)||level<1||level>4))error='Nivel de desempeño debe ser 1–4';
        if(!error&&row.percentil!==''&&(!Number.isFinite(Number(row.percentil))||Number(row.percentil)<0||Number(row.percentil)>100))error='Percentil debe estar entre 0 y 100';
        if(!error&&row.media_grupo_referencia!==''&&(!Number.isFinite(Number(row.media_grupo_referencia))||Number(row.media_grupo_referencia)<0||Number(row.media_grupo_referencia)>300))error='La media de referencia debe estar entre 0 y 300';
        row._status=error?`ERROR: ${error}`:'VÁLIDA';return row;
      }
      if(source==='perception'){
        const row={...base,codigo_estudiante:cell(cells,pick('codigoestudiante','codigo','codigodeestudiante')),periodo:cell(cells,pick('periodo','periodoacademico')),semestre:cell(cells,pick('semestre','sem')),ra:cell(cells,pick('ra','resultadoaprendizaje')).toUpperCase(),item:cell(cells,pick('item','pregunta')),respuesta:cell(cells,pick('respuesta','valor'))};
        const value=Number(row.respuesta);if(!row.codigo_estudiante||!row.periodo||!row.semestre||!data.ra.some(x=>x.id===row.ra)||!row.item||!Number.isInteger(value)||value<1||value>5)error='Código, periodo, semestre, RA, ítem y respuesta 1–5 son obligatorios';row._status=error?`ERROR: ${error}`:'VÁLIDA';return row;
      }
      const rawType=core.normalize(cell(cells,pick('tipoinformante','informante','tipo'))),type=rawType.includes('egres')?'egresado':rawType.includes('emple')?'empleador':'';
      const row={...base,tipo_informante:type,periodo:cell(cells,pick('periodo','periodoacademico')),anio_egreso:cell(cells,pick('anioegreso','anoegreso')),ra:cell(cells,pick('ra','resultadoaprendizaje')).toUpperCase(),item:cell(cells,pick('item','pregunta')),respuesta:cell(cells,pick('respuesta','valor'))};
      const value=Number(row.respuesta);if(!type||!row.periodo||!data.ra.some(x=>x.id===row.ra)||!row.item||!Number.isInteger(value)||value<1||value>5)error='Tipo de informante, periodo, RA, ítem y respuesta 1–5 son obligatorios';row._status=error?`ERROR: ${error}`:'VÁLIDA';return row;
    });
  }

  async function loadSource(source,file) {
    try { const rows=sourceParser(source,await file.text(),file.name);state.sources[source]=[...state.sources[source],...rows];state.imports[source].push({file:file.name,total:rows.length,valid:rows.filter(x=>x._status==='VÁLIDA').length});persist(); }
    catch(error){alert(error.message);}
  }

  function renderItemsEditor() {
    $('#v20-items-editor').innerHTML=data.ra.map(ra=>`<fieldset class="v20-item-editor"><legend>${esc(ra.id)} · ${esc(ra.name)}</legend>${(state.config.items[ra.id]||[]).map((item,index)=>`<label>Ítem ${index+1}<textarea data-item-ra="${ra.id}" data-item-index="${index}" rows="3">${esc(item)}</textarea></label>`).join('')}</fieldset>`).join('');
  }

  function renderModuleMappings() {
    const host=$('#v20-module-mappings');host.innerHTML=`<table><thead><tr><th>Módulo Saber Pro</th><th>RA asociados</th><th>Corte mínimo nivel 2</th><th>Nivel 3</th><th>Nivel 4</th><th></th></tr></thead><tbody>${state.config.modules.map((module,index)=>`<tr><td><input type="text" data-module-index="${index}" data-module-field="module" value="${esc(module.module)}" aria-label="Nombre del módulo"></td><td><div class="v20-module-ra">${data.ra.map(ra=>`<label><input type="checkbox" data-module-index="${index}" data-module-ra="${ra.id}"${module.ras.includes(ra.id)?' checked':''}>${ra.id}</label>`).join('')}</div></td>${['cut2','cut3','cut4'].map((key,i)=>`<td><input type="number" min="0" max="300" step="1" data-module-index="${index}" data-module-field="${key}" value="${esc(module[key])}" aria-label="Puntaje mínimo de nivel ${i+2}"></td>`).join('')}<td><button class="button ghost" type="button" data-module-remove="${index}" aria-label="Eliminar módulo">×</button></td></tr>`).join('')}</tbody></table>`;
  }

  function sourceTemplates(source) {
    if(source==='saberPro')return [['codigo_estudiante','periodo_aplicacion','modulo','puntaje','nivel_desempeno','percentil','media_grupo_referencia'],['EST-001','2025-1','Lectura crítica','180','3','','']];
    if(source==='perception'){
      const rows=[['codigo_estudiante','periodo','semestre','ra','item','respuesta']];
      data.ra.forEach(ra=>(state.config.items[ra.id]||[]).forEach(item=>rows.push(['EST-001','2025-1','1',ra.id,item,'4'])));return rows;
    }
    return [['tipo_informante','periodo','anio_egreso','ra','item','respuesta'],['egresado','2025-1','2023','RA1','Valoro la pertinencia de la formación recibida para este resultado','4'],['empleador','2025-1','','RA1','El profesional demuestra este resultado en su desempeño','5']];
  }

  function directByPeriod() { return core.computeCriterial({rows:noteRows(),subjects:data.subjects,raList:data.ra,config:state.config,groupBySemester:false}); }
  function saberParticipantRows() {
    const groups=new Map();
    for(const row of state.sources.saberPro){if(row._status!=='VÁLIDA')continue;const level=classifySaber(row);if(level===null)continue;const module=state.config.modules.find(m=>hnorm(m.module)===hnorm(row.modulo));if(!module)continue;
      for(const ra of module.ras){const key=[row.codigo_estudiante,row.periodo_aplicacion,ra].join('|'),group=groups.get(key)||{student:row.codigo_estudiante,period:row.periodo_aplicacion,ra,levels:[]};group.levels.push(level);groups.set(key,group);}}
    return [...groups.values()].map(g=>({...g,level:g.levels.reduce((a,b)=>a+b,0)/g.levels.length,success:g.levels.reduce((a,b)=>a+b,0)/g.levels.length>=state.config.saberProMinimumLevel}));
  }
  function perceptionParticipantRows(includeSemester=false) {
    const groups=new Map();for(const row of state.sources.perception){if(row._status!=='VÁLIDA')continue;const key=[row.codigo_estudiante,row.periodo,includeSemester?row.semestre:'',row.ra].join('|'),group=groups.get(key)||{student:row.codigo_estudiante,period:row.periodo,semester:includeSemester?row.semestre:'Todos',ra:row.ra,responses:[]};group.responses.push(Number(row.respuesta));groups.set(key,group);}
    return [...groups.values()].map(g=>({...g,mean:g.responses.reduce((a,b)=>a+b,0)/g.responses.length,success:g.responses.reduce((a,b)=>a+b,0)/g.responses.length>=4}));
  }
  function stakeholdersGroups() {
    const groups=new Map();for(const row of state.sources.stakeholders){if(row._status!=='VÁLIDA')continue;const key=[row.periodo,row.ra,row.tipo_informante].join('|'),group=groups.get(key)||{period:row.periodo,ra:row.ra,type:row.tipo_informante,responses:[]};group.responses.push(Number(row.respuesta));groups.set(key,group);}
    return [...groups.values()].map(g=>({...g,mean:g.responses.reduce((a,b)=>a+b,0)/g.responses.length,n:g.responses.length,success:g.responses.filter(x=>x>=4).length}));
  }
  function summaryParticipants(rows) {
    if(!rows.length)return null;const successful=rows.filter(r=>r.success).length;return {n:rows.length,success:successful,pct:pct(successful,rows.length)};
  }
  function sourceSummaries() {
    const direct=directByPeriod(),saber=saberParticipantRows(),perception=perceptionParticipantRows(),stakeholders=stakeholdersGroups(),out=new Map();
    const ensure=(period,ra)=>{const key=[period,ra].join('|'),item=out.get(key)||{period,ra,sources:{}};out.set(key,item);return item;};
    for(const ra of data.ra)for(const period of new Set([...direct.map(x=>x.period),...saber.map(x=>x.period),...perception.map(x=>x.period),...stakeholders.map(x=>x.period)]))ensure(period,ra.id);
    for(const ra of data.ra){
      const periods=new Set([...direct.filter(x=>x.ra===ra.id).map(x=>x.period),...saber.filter(x=>x.ra===ra.id).map(x=>x.period),...perception.filter(x=>x.ra===ra.id).map(x=>x.period),...stakeholders.filter(x=>x.ra===ra.id).map(x=>x.period)]);
      for(const period of periods){const item=ensure(period,ra.id),d=summaryParticipants(direct.filter(x=>x.ra===ra.id&&x.period===period).map(x=>({success:x.achieves}))),s=summaryParticipants(saber.filter(x=>x.ra===ra.id&&x.period===period)),p=summaryParticipants(perception.filter(x=>x.ra===ra.id&&x.period===period));
        if(d)item.sources.direct={...d,name:'Directa'};if(s)item.sources.saber={...s,name:'Saber Pro'};if(p)item.sources.perception={...p,name:'Autopercepción'};
        for(const type of ['egresado','empleador']){const group=stakeholders.find(x=>x.ra===ra.id&&x.period===period&&x.type===type);if(group){const n=group.n,itemValue={n,success:group.success,pct:pct(group.success,n),name:type==='egresado'?'Egresados':'Empleadores'};if(n>=state.config.minimumN)item.sources[type]=itemValue;else item.sources[type]={...itemValue,pct:null,insufficient:true};}}
      }
    }
    return [...out.values()].map(item=>{
      const goal=Number(state.config.raTargets[item.ra]??80),available=Object.values(item.sources).filter(x=>x.pct!=null&&x.n>=state.config.minimumN),values=available.map(x=>x.pct),spread=values.length?Math.max(...values)-Math.min(...values):null;
      let classification='Evidencia insuficiente',detail='Se requieren al menos dos fuentes con n suficiente.';
      if(available.length>=2){if(spread<=state.config.divergenceTolerance){classification='Convergente';detail=`Diferencia máxima entre fuentes: ${spread.toFixed(1)} puntos porcentuales.`;}else{classification='Divergente';const high=available.reduce((a,b)=>a.pct>b.pct?a:b),low=available.reduce((a,b)=>a.pct<b.pct?a:b);detail=`${low.name} está ${Math.abs(high.pct-low.pct).toFixed(1)} puntos porcentuales por debajo de ${high.name}.`;}}
      item.goal=goal;item.classification=classification;item.detail=detail;return item;
    }).sort((a,b)=>a.period.localeCompare(b.period)||a.ra.localeCompare(b.ra));
  }

  function semaforo(metric,goal) { if(metric==null)return 'Sin dato';const diff=goal-metric;return diff<=0?'Alcanza la meta':diff<=state.config.margin?'Cerca de la meta':'Bajo la meta'; }
  function renderSourceMetrics() {
    const saber=saberParticipantRows(),perception=perceptionParticipantRows(true),stakeholders=stakeholdersGroups();
    const rows=[];
    for(const ra of data.ra){const groups=new Map();for(const item of perception.filter(x=>x.ra===ra.id)){const key=[item.period,item.semester,item.ra].join('|'),g=groups.get(key)||{period:item.period,semester:item.semester,ra:item.ra,values:[]};g.values.push(item);groups.set(key,g);}for(const g of groups.values()){const values=g.values.map(x=>x.mean),summary=core.stats(values),agree=pct(g.values.filter(x=>x.success).length,g.values.length);rows.push(`<tr><td>Autopercepción</td><td>${esc(g.period)}</td><td>${esc(g.semester)}</td><td>${g.ra}</td><td>—</td><td>${fmt(summary.mean)}</td><td>${fmt(summary.sd)}</td><td>${fmt(agree,1)}%</td><td>${g.values.length}</td></tr>`);}}
    for(const group of stakeholders){const agree=pct(group.success,group.n),show=group.n>=state.config.minimumN;rows.push(`<tr><td>${group.type==='egresado'?'Egresados':'Empleadores'}</td><td>${esc(group.period)}</td><td>—</td><td>${group.ra}</td><td>—</td><td>${show?fmt(group.mean):'—'}</td><td>—</td><td>${show?fmt(agree,1)+'%':'n insuficiente'}</td><td>${group.n}</td></tr>`);}
    for(const group of [...new Set(saber.map(x=>`${x.period}|${x.ra}`))]){const [period,ra]=group.split('|'),items=saber.filter(x=>x.period===period&&x.ra===ra),mean=items.reduce((sum,x)=>sum+x.level,0)/items.length,agree=pct(items.filter(x=>x.success).length,items.length);rows.push(`<tr><td>Saber Pro</td><td>${esc(period)}</td><td>—</td><td>${ra}</td><td>${fmt(mean)}</td><td>—</td><td>—</td><td>${fmt(agree,1)}%</td><td>${items.length}</td></tr>`);}
    $('#v20-indirect-metrics').innerHTML=`<table><thead><tr><th>Fuente</th><th>Periodo</th><th>Semestre</th><th>RA</th><th>Nivel medio Saber Pro</th><th>Media Likert</th><th>Desv. estándar Likert</th><th>% igual o superior / acuerdo</th><th>n</th></tr></thead><tbody>${rows.join('')||'<tr><td colspan="9" class="muted">Cargue al menos una fuente para ver sus métricas.</td></tr>'}</tbody></table>`;
  }

  function renderTriangulation() {
    const rows=sourceSummaries(),periodSel=$('#v20-triangulation-period'),oldPeriod=periodSel.value,periods=[...new Set(rows.map(x=>x.period))].sort();periodSel.innerHTML='<option value="">Todos</option>'+periods.map(x=>`<option>${esc(x)}</option>`).join('');periodSel.value=periods.includes(oldPeriod)?oldPeriod:'';
    const raSel=$('#v20-triangulation-ra'),oldRa=raSel.value;raSel.innerHTML='<option value="">Todos</option>'+data.ra.map(x=>`<option>${x.id}</option>`).join('');raSel.value=data.ra.some(x=>x.id===oldRa)?oldRa:'';
    const filtered=rows.filter(x=>(!periodSel.value||x.period===periodSel.value)&&(!raSel.value||x.ra===raSel.value));
    const sourceCell=(item,key)=>{const source=item.sources[key];if(!source)return '—';const goal=item.goal;if(source.pct==null)return `<span class="v20-unstable">n=${source.n} · estimación no reportada</span>`;return `<strong>${source.pct.toFixed(1)}%</strong> · n=${source.n}<small>${semaforo(source.pct,goal)}${source.n<state.config.minimumN?' · estimación inestable':''}</small>`;};
    $('#v20-triangulation-table').innerHTML=filtered.length?filtered.map(item=>`<tr><td>${esc(item.period)}</td><td>${item.ra}</td><td>${sourceCell(item,'direct')}</td><td>${sourceCell(item,'saber')}</td><td>${sourceCell(item,'perception')}</td><td>${sourceCell(item,'egresado')}</td><td>${sourceCell(item,'empleador')}</td><td><strong>${esc(item.classification)}</strong><small>${esc(item.detail)}</small></td></tr>`).join(''):'<tr><td colspan="8" class="muted">Cargue datos de al menos dos fuentes o cambie los filtros.</td></tr>';
    renderTriangulationChart(filtered);
  }

  function renderTriangulationChart(rows) {
    const target=$('#v20-triangulation-chart');if(!rows.length){target.innerHTML='';return;}
    const width=Math.max(720,rows.length*180+140),height=360,left=170,right=38,top=34,bottom=36,plotW=width-left-right,plotH=height-top-bottom,x=v=>left+plotW*v/100,labels=['direct','saber','perception','egresado','empleador'],colors={direct:'#0f5c76',saber:'#a15d36',perception:'#527e65',egresado:'#775b9a',empleador:'#b14e6a'},shapes={direct:'circle',saber:'rect',perception:'diamond',egresado:'triangle',empleador:'cross'},rowH=plotH/rows.length;
    let svg=`<svg class="v20-svg-chart v20-triangulation-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Puntos porcentuales de las fuentes por resultado de aprendizaje"><title>Fuentes de evidencia y meta configurable por RA</title>`;
    for(const v of [0,20,40,60,80,100])svg+=`<line class="gridline" x1="${x(v)}" y1="${top}" x2="${x(v)}" y2="${height-bottom}"/><text class="axis-label" x="${x(v)}" y="${height-12}" text-anchor="middle">${v}%</text>`;
    rows.forEach((item,i)=>{const cy=top+rowH*(i+.5),targetX=x(item.goal);svg+=`<text class="axis-label" x="${left-12}" y="${cy+4}" text-anchor="end">${esc(item.period)} · ${item.ra}</text><line x1="${targetX}" y1="${cy-rowH*.4}" x2="${targetX}" y2="${cy+rowH*.4}" stroke="#222" stroke-width="2" stroke-dasharray="3 3"><title>Meta ${item.goal}%</title></line>`;labels.forEach(key=>{const source=item.sources[key];if(!source||source.pct==null)return;const yy=cy+(labels.indexOf(key)-2)*Math.min(6,rowH*.1),xx=x(source.pct),color=colors[key];let mark=shapes[key]==='circle'?`<circle cx="${xx}" cy="${yy}" r="5" fill="${color}"/>`:shapes[key]==='rect'?`<rect x="${xx-5}" y="${yy-5}" width="10" height="10" fill="${color}"/>`:shapes[key]==='diamond'?`<path d="M${xx} ${yy-6}L${xx+6} ${yy}L${xx} ${yy+6}L${xx-6} ${yy}Z" fill="${color}"/>`:shapes[key]==='triangle'?`<path d="M${xx} ${yy-6}L${xx+6} ${yy+5}L${xx-6} ${yy+5}Z" fill="${color}"/>`:`<path d="M${xx-5} ${yy-5}L${xx+5} ${yy+5}M${xx+5} ${yy-5}L${xx-5} ${yy+5}" stroke="${color}" stroke-width="2"/>`;svg+=`<g>${mark}<title>${esc(source.name)} · ${source.pct.toFixed(1)}% · n=${source.n}</title></g>`;});});
    svg+='</svg><div class="v20-chart-legend">'+labels.map(key=>`<span><i style="background:${colors[key]}"></i>${({direct:'Directa',saber:'Saber Pro',perception:'Autopercepción',egresado:'Egresados',empleador:'Empleadores'})[key]}</span>`).join('')+'<span>┆ Meta RA</span></div>';target.innerHTML=svg;
  }

  function kappaLabel(value) { if(value==null)return 'No calculable';if(value<0)return 'Sin concordancia';if(value<=.20)return 'Leve';if(value<=.40)return 'Aceptable';if(value<=.60)return 'Moderada';if(value<=.80)return 'Considerable';return 'Casi perfecta'; }
  function renderAgreement() {
    const direct=directByPeriod(),saber=saberParticipantRows(),perception=perceptionParticipantRows(),sections=[];
    for(const ra of data.ra){for(const source of ['saber','perception']){
      const external=source==='saber'?saber.filter(x=>x.ra===ra.id).map(x=>({student:x.student,period:x.period,success:x.success})):perception.filter(x=>x.ra===ra.id).map(x=>({student:x.student,period:x.period,success:x.success}));
      const externalMap=new Map();for(const item of external){const key=[item.student,item.period].join('|');const existing=externalMap.get(key);if(existing)existing.values.push(item.success);else externalMap.set(key,{...item,values:[item.success]});}
      const directMap=new Map(direct.filter(x=>x.ra===ra.id).map(x=>[[x.student,x.period].join('|'),x]));
      const pairs=[];for(const [key,ext] of externalMap){const d=directMap.get(key);if(!d)continue;const extSuccess=ext.values.filter(Boolean).length>=Math.ceil(ext.values.length/2);pairs.push({left:d.achieves,right:extSuccess});}
      const result=core.cohenKappa(pairs),label=source==='saber'?'Saber Pro':'Autopercepción';
      const show=result.n>=state.config.minimumN;sections.push(`<article class="v20-agreement-card"><h4>${ra.id} · Directa × ${label}</h4><div class="table-wrap"><table class="v20-confusion"><thead><tr><th></th><th colspan="2">${label}</th></tr><tr><th>Directa</th><th>Logra / acuerdo</th><th>No logra / desacuerdo</th></tr></thead><tbody><tr><th>Logra / acuerdo</th><td>${result.a||0}</td><td>${result.b||0}</td></tr><tr><th>No logra / desacuerdo</th><td>${result.c||0}</td><td>${result.d||0}</td></tr></tbody></table></div><p>Acuerdo: ${show?fmt(result.agreement,1)+'%':'—'} · Kappa: ${show?fmt(result.kappa,3):'—'} · n=${result.n} · ${show?kappaLabel(result.kappa):'Estimación inestable: n inferior al mínimo configurado.'}</p></article>`);
    }}
    $('#v20-agreement-tables').innerHTML=sections.join('');
  }

  function renderAll() {
    renderConfig();renderItemsEditor();renderModuleMappings();
    for(const source of ['saberPro','perception','stakeholders'])qualityRows(source);
    renderCriteria();renderSourceMetrics();renderTriangulation();renderAgreement();
  }

  function exportCriteriaCsv() {
    const rows=baseGroups(criterionRows()),header=['Periodo','Semestre','RA','n estudiantes','n evidencias','Media','Desviacion estandar','Mediana','Q1','Q3','Rango intercuartilico','Umbral esperado','Porcentaje nivel esperado','Bajo %','Medio %','Alto %','Superior %'];
    const body=rows.map(g=>[g.period,g.semester,g.ra,g.rows.length,g.evidenceCount,g.stats.mean,g.stats.sd,g.stats.median,g.stats.q1,g.stats.q3,g.stats.q3-g.stats.q1,g.threshold,g.successPct,...core.BAND_ORDER.map(b=>pct(g.byBand[b],g.rows.length))]);
    download('CORA-V20-tabla-criterial.csv','\uFEFF'+[header,...body].map(row=>row.map(csvEscape).join(';')).join('\r\n'),'text/csv;charset=utf-8');
  }
  function exportTriangulationCsv() {
    const rows=sourceSummaries(),header=['Periodo','RA','Fuente','Porcentaje','n','Meta RA','Semaforo','Clasificacion triangulacion'];
    const body=rows.flatMap(item=>Object.entries(item.sources).map(([source,value])=>[item.period,item.ra,source,value.pct,value.n,item.goal,semaforo(value.pct,item.goal),item.classification]));
    download('CORA-V20-matriz-triangulacion.csv','\uFEFF'+[header,...body].map(row=>row.map(csvEscape).join(';')).join('\r\n'),'text/csv;charset=utf-8');
  }
  function reportHtml() {
    const groups=baseGroups(criterionRows()),tri=sourceSummaries(),agreement=$('#v20-agreement-tables').innerHTML,provisional=state.approved?'Aprobada localmente por comité':'VALOR PROVISIONAL SUJETO A APROBACIÓN DEL COMITÉ CURRICULAR';
    const table=(heads,rows)=>`<table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
    const kpiConfigTable=table(['KPI','RA','Banda mínima','Meta','Alcance'],data.profile.map(p=>{const c=state.config.kpis[p.indicator],k=data.indicators.find(x=>x.id===p.indicator);return `<tr><td>${p.indicator} · ${esc(k?.description)}</td><td>${p.ra}</td><td>${esc(c.minimumBand)}</td><td>${c.target}%</td><td>${esc(c.scope)}</td></tr>`;}));
    const kpiRows=[];
    for(const profile of data.profile){
      const config=state.config.kpis[profile.indicator],indicator=data.indicators.find(x=>x.id===profile.indicator);
      const values=criterionRows({ra:profile.ra,scope:config.scope});
      const grouped=new Map();
      for(const row of values){const key=[row.period,row.semester].join('|'),group=grouped.get(key)||{period:row.period,semester:row.semester,rows:[]};group.rows.push(row);grouped.set(key,group);}
      if(!grouped.size)kpiRows.push(`<tr><td>${esc(profile.indicator)} · ${esc(indicator?.description)}</td><td>${profile.ra}</td><td>—</td><td>—</td><td>${config.target}%</td><td>0</td><td>Sin datos</td></tr>`);
      for(const group of grouped.values()){
        const reached=group.rows.filter(row=>rankBand(row.band)>=rankBand(config.minimumBand)).length,percent=pct(reached,group.rows.length),signal=percent==null?'Sin datos':percent>=config.target?'Alcanza la meta':percent>=config.target-state.config.margin?'Cerca de la meta':'Bajo la meta';
        kpiRows.push(`<tr><td>${esc(profile.indicator)} · ${esc(indicator?.description)}</td><td>${profile.ra}</td><td>${esc(group.period)} · semestre ${esc(group.semester)}</td><td>${percent==null?'—':fmt(percent,1)+'%'}</td><td>${config.target}%</td><td>${group.rows.length}</td><td>${group.rows.length<state.config.minimumN?'Estimación inestable · ':''}${signal}</td></tr>`);
      }
    }
    const kpiResultsTable=table(['KPI','RA','Periodo · semestre','Resultado','Meta','n','Estado'],kpiRows);
    const distTable=table(['Periodo','Semestre','RA','n','Media','DE','Mediana','Umbral','Logro'],groups.map(g=>`<tr><td>${esc(g.period)}</td><td>${g.semester}</td><td>${g.ra}</td><td>${g.rows.length}</td><td>${fmt(g.stats.mean)}</td><td>${fmt(g.stats.sd)}</td><td>${fmt(g.stats.median)}</td><td>${fmt(g.threshold)}</td><td>${fmt(g.successPct,1)}%</td></tr>`));
    const triTable=table(['Periodo','RA','Directa','Saber Pro','Autopercepción','Egresados','Empleadores','Clasificación'],tri.map(x=>`<tr><td>${esc(x.period)}</td><td>${x.ra}</td>${['direct','saber','perception','egresado','empleador'].map(k=>`<td>${x.sources[k]?.pct==null?'—':fmt(x.sources[k].pct,1)+'% (n='+x.sources[k].n+')'}</td>`).join('')}<td>${esc(x.classification)} · ${esc(x.detail)}</td></tr>`));
    const html=`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CORA V20 · Informe de logro criterial y triangulación</title><style>body{font:14px/1.55 Arial,sans-serif;max-width:1200px;margin:32px auto;padding:0 18px;color:#243345}h1,h2{color:#153d62}table{width:100%;border-collapse:collapse;margin:14px 0 26px}th,td{border:1px solid #d7dfe5;padding:7px;text-align:left;vertical-align:top}th{background:#edf3f6}.alert{padding:12px;background:#fff4da;border-left:4px solid #bc8a2e}.muted{color:#5f6d77}</style><h1>CORA · Fisioterapia · Propuesta V20</h1><p>Informe de logro criterial y triangulación · ${new Date().toLocaleDateString('es-CO')}</p><p class="alert"><strong>Estado de configuración:</strong> ${esc(provisional)}. Umbrales: ${esc(JSON.stringify(state.config.thresholds))}. Tamaño mínimo: ${state.config.minimumN}. Margen semáforo: ${state.config.margin} p.p. Tolerancia convergencia: ${state.config.divergenceTolerance} p.p.</p><h2>Metodología criterial</h2><p>Media de evidencias válidas por estudiante y asignatura en nota original 0–5. Luego promedio por estudiante × RA × semestre × periodo, ponderado por créditos; umbral ponderado con los umbrales del nivel de aporte. Hay logro si nota criterial ≥ umbral. Bandas se asignan con la nota redondeada a dos decimales. Los KPI filtran su alcance antes de calcular la nota criterial y reportan el porcentaje en la banda mínima o superior.</p><h2>Resultados de KPI</h2>${kpiResultsTable}<h2>Configuración KPI</h2>${kpiConfigTable}<h2>Distribuciones y tabla criterial</h2>${distTable}<h2>Matriz de triangulación</h2>${triTable}<h2>Concordancia</h2>${agreement}<p class="muted">Los valores provisionales requieren validación curricular. Fuentes con muestra insuficiente se indican o no se reportan según el tipo de fuente.</p></html>`;
    download('CORA-V20-informe-criterial-triangulacion.html',html,'text/html;charset=utf-8');
  }

  function resetExample() {
    if(!confirm('Este ejemplo reemplazará las notas y fuentes de evidencia de la propuesta V20 en este navegador. ¿Continuar?'))return;
    const students=Array.from({length:20},(_,i)=>`EST-${String(i+1).padStart(3,'0')}`),periods=['2025-1','2025-2'];
    const chosen=new Map(data.ra.map(ra=>[ra.id,data.subjects.find(c=>c[ra.id.toLowerCase()]==='DOMINA')||data.subjects.find(c=>c[ra.id.toLowerCase()])]));
    const gradeRows=[];let line=2;
    for(const period of periods)for(let i=0;i<students.length;i++){
      const used=new Set();for(const course of chosen.values())if(course&&!used.has(course.id)){used.add(course.id);gradeRows.push({line:line++,asignatura:course.name,estudiante:students[i],nota:(4.1+(i%4)*.2).toFixed(1),actividad:'Evidencia ilustrativa',instrumento:'Rúbrica de ejemplo',codigoActividad:'',tipoNota:'asignatura',periodo:period,sourceFile:'ejemplo-criterial-v20.csv'});}
    }
    localStorage.setItem('cora-fisioterapia-propuesta-v20-v1',JSON.stringify({rows:gradeRows,uploads:[{file:'ejemplo-criterial-v20.csv',period:'2025-1 / 2025-2',tipoNota:'asignatura',total:gradeRows.length,valid:gradeRows.length,omitted:0}]}));
    const saber=[],perception=[],stakeholders=[];
    for(const period of periods)for(let i=0;i<students.length;i++){
      for(const module of state.config.modules){if(!module.ras.length)continue;const low=hnorm(module.module)==='comunicacionescrita';saber.push({_line:saber.length+2,_file:'ejemplo-saber-pro.csv',codigo_estudiante:students[i],periodo_aplicacion:period,modulo:module.module,puntaje:low?'165':'220',nivel_desempeno:low?'2':'3',percentil:'',media_grupo_referencia:'',_status:'VÁLIDA'});}
      for(const ra of data.ra){perception.push({_line:perception.length+2,_file:'ejemplo-autopercepcion.csv',codigo_estudiante:students[i],periodo,semestre:'7',ra:ra.id,item:(state.config.items[ra.id]||[])[0],respuesta:'5',_status:'VÁLIDA'});for(const type of ['egresado','empleador'])stakeholders.push({_line:stakeholders.length+2,_file:'ejemplo-informantes.csv',tipo_informante:type,periodo,anio_egreso:'2023',ra:ra.id,item:'Valoración ilustrativa del resultado',respuesta:type==='empleador'&&ra.id==='RA5'?'2':'5',_status:'VÁLIDA'});}
    }
    state.sources={saberPro:saber,perception,stakeholders};state.imports={saberPro:[{file:'ejemplo-saber-pro.csv',total:saber.length,valid:saber.length}],perception:[{file:'ejemplo-autopercepcion.csv',total:perception.length,valid:perception.length}],stakeholders:[{file:'ejemplo-informantes.csv',total:stakeholders.length,valid:stakeholders.length}]};persist();
    window.setTimeout(()=>window.location.reload(),100);
  }

  $('#v20-config-form').addEventListener('submit',event=>{event.preventDefault();const next=collectConfig(),error=core.validateConfig(next);if(error){$('#v20-config-error').textContent=error;$('#v20-config-error').hidden=false;return;}state.config=next;state.approved=$('#v20-config-approved').checked;$('#v20-config-error').hidden=true;persist();});
  $('#v20-config-approved').addEventListener('change',event=>{const next=collectConfig(),error=core.validateConfig(next);if(error){event.target.checked=false;state.approved=false;$('#v20-config-error').textContent=error;$('#v20-config-error').hidden=false;activeSettingsNotice();return;}state.config=next;state.approved=event.target.checked;$('#v20-config-error').hidden=true;persist();});
  $('#v20-config-fields').addEventListener('input',()=>{state.approved=false;$('#v20-config-approved').checked=false;activeSettingsNotice();});
  $('#v20-config-export').addEventListener('click',()=>download('CORA-V20-configuracion-criterial.json',JSON.stringify({curricularVersion:data.metadata.version,approved:state.approved,config:state.config},null,2),'application/json'));
  $('#v20-config-import').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text()),config=parsed.config||parsed,next=core.migrateState({config},defaultState()).config,error=core.validateConfig(next);if(error)throw Error(error);state.config=next;state.approved=false;persist();}catch(error){alert(`No se pudo importar la configuración: ${error.message}`);}event.target.value='';});
  $('#v20-config-reset').addEventListener('click',()=>{if(!confirm('¿Restablecer únicamente los criterios V20 a sus valores provisionales?'))return;state.config=defaultConfig();state.approved=false;persist();});
  $('#v20-module-mappings').addEventListener('change',event=>{
    const index=Number(event.target.dataset.moduleIndex);if(!Number.isInteger(index)||!state.config.modules[index])return;
    if(event.target.dataset.moduleRa){const ra=event.target.dataset.moduleRa,set=new Set(state.config.modules[index].ras);event.target.checked?set.add(ra):set.delete(ra);state.config.modules[index].ras=[...set];}
    else if(event.target.dataset.moduleField)state.config.modules[index][event.target.dataset.moduleField]=event.target.value;
    state.approved=false;persist();
  });
  $('#v20-add-module').addEventListener('click',()=>{state.config.modules.push({module:'',ras:[],cut2:'',cut3:'',cut4:''});state.approved=false;persist();});
  $('#v20-module-mappings').addEventListener('click',event=>{const button=event.target.closest('[data-module-remove]');if(!button)return;state.config.modules.splice(Number(button.dataset.moduleRemove),1);state.approved=false;persist();});
  $('#v20-items-editor').addEventListener('change',event=>{const ra=event.target.dataset.itemRa,index=Number(event.target.dataset.itemIndex);if(!ra||!Number.isInteger(index))return;state.config.items[ra][index]=event.target.value;state.approved=false;persist();});
  for(const [source,id] of [['saberPro','v20-saber-file'],['perception','v20-perception-file'],['stakeholders','v20-stakeholders-file']])$(`#${id}`).addEventListener('change',async event=>{const file=event.target.files?.[0];if(file)await loadSource(source,file);event.target.value='';});
  document.querySelectorAll('[data-v20-template]').forEach(button=>button.addEventListener('click',()=>{const source=button.dataset.v20Template,rows=sourceTemplates(source),content=rows.map(row=>row.map(csvEscape).join(';')).join('\r\n');download(`plantilla_${source==='saberPro'?'saber_pro':source==='perception'?'autopercepcion_estudiantil':'egresados_empleadores'}_V20.csv`,'\uFEFF'+content,'text/csv;charset=utf-8');}));
  document.querySelectorAll('[data-v20-clear-source]').forEach(button=>button.addEventListener('click',()=>{const source=button.dataset.v20ClearSource;if(!confirm('¿Limpiar solo esta fuente de evidencia de la propuesta V20?'))return;state.sources[source]=[];state.imports[source]=[];persist();}));
  $('#v20-criteria-period').addEventListener('change',renderCriteria);$('#v20-criteria-semester').addEventListener('change',renderCriteria);
  $('#v20-criteria-ra-filter').addEventListener('change',event=>{if(event.target.type!=='checkbox')return;event.target.checked?selectedRAs.add(event.target.value):selectedRAs.delete(event.target.value);renderCriteria();});
  $('#v20-triangulation-period').addEventListener('change',renderTriangulation);$('#v20-triangulation-ra').addEventListener('change',renderTriangulation);
  $('#proposal-student')?.addEventListener('change',renderStudentCriteria);$('#proposal-student-period')?.addEventListener('change',renderStudentCriteria);
  $('#proposal-chart-metric')?.addEventListener('change',()=>window.CORA_FISIO_V20_REFRESH?.());$('#proposal-table-metric')?.addEventListener('change',()=>window.CORA_FISIO_V20_REFRESH?.());
  document.querySelectorAll('.proposal-sidebar [data-proposal-view]').forEach(button=>button.addEventListener('click',()=>setTimeout(renderAll,0)));
  $('#v20-criterial-csv').addEventListener('click',exportCriteriaCsv);$('#v20-triangulation-csv')?.addEventListener('click',exportTriangulationCsv);$('#v20-criterial-report').addEventListener('click',reportHtml);$('#v20-triangulation-example').addEventListener('click',resetExample);

  window.CORA_V20_EVIDENCE={refresh:renderAll,getCriterialRows(period=''){return criterionRows({period}).map(row=>({...row,direct:row.score,credit:null,comparable:null,count:row.evidenceCount,averageFactor:1}));},getStudentRows:criterionRows,exportTriangulationCsv};
  window.CORA_FISIO_V20_REFRESH=renderAll;
  renderAll();
})();
