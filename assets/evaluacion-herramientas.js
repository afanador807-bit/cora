/* Vistas integradas del paquete de evaluación. Las evaluaciones registradas
   se convierten en evidencias CORA en el almacenamiento local del navegador. */
(function () {
  'use strict';
  var C = window.EvaluacionRA;
  var rubric = window.CORA_RUBRICA_P2;
  var attitudeCriteria = window.CORA_CRITERIOS_ACTITUDINALES;
  var rubricState = {};
  var attitudeState = [null, null, null, null];
  var agent = 'DOC';
  var periodValues = [];
  var subjects = window.MOTOR_RA_MAPEO.subjects;
  var draftToRestore = null;
  try { draftToRestore = JSON.parse(localStorage.getItem('cora-rubrica-borrador-v1') || 'null'); } catch (_) { draftToRestore = null; }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }
  function noteRows(selector) { var el = document.querySelector(selector); return el ? el.innerHTML : ''; }
  function setOptions(selector, options, selected, placeholder) {
    var el = document.querySelector(selector);
    if (!el) return;
    var html = options.map(function (value) { return '<option value="' + esc(value) + '">' + esc(value) + '</option>'; }).join('');
    el.innerHTML = (placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '') + html;
    el.value = options.indexOf(selected) >= 0 ? selected : (placeholder ? '' : (options[0] || ''));
  }
  function refreshFormOptions() {
    var rows = window.coraGetAllRows ? window.coraGetAllRows() : [];
    periodValues = Array.from(new Set(rows.map(function (r) { return String(r.periodo || '').trim(); }).filter(Boolean)));
    for (var year = 2024; year <= 2035; year++) {
      periodValues.push(year + '-1', year + '-2');
    }
    periodValues = Array.from(new Set(periodValues)).sort(function (a, b) {
      var aa = a.match(/(\d{4})\D*(\d)/), bb = b.match(/(\d{4})\D*(\d)/);
      return (aa ? Number(aa[1]) * 10 + Number(aa[2]) : 0) - (bb ? Number(bb[1]) * 10 + Number(bb[2]) : 0);
    });
    var currentPeriod = rows.length ? String(rows[rows.length - 1].periodo || '2026-2') : '2026-2';
    ['#eval-period', '#att-period'].forEach(function (selector) {
      var old = document.querySelector(selector).value || currentPeriod;
      setOptions(selector, periodValues, old);
    });
    var evalSubjects = subjects.filter(function (s) { return s.activities.indexOf('P2-SE') >= 0; }).map(function (s) { return s.name; });
    var attitudeSubjects = subjects.filter(function (s) { return s.activities.indexOf('A') >= 0; }).map(function (s) { return s.name; });
    setOptions('#eval-subject', evalSubjects, document.querySelector('#eval-subject').value, 'Seleccione una asignatura');
    setOptions('#att-subject', attitudeSubjects, document.querySelector('#att-subject').value, 'Seleccione una asignatura');
    if (draftToRestore) {
      document.querySelector('#eval-period').value = draftToRestore.periodo || document.querySelector('#eval-period').value;
      document.querySelector('#eval-subject').value = draftToRestore.asignatura || '';
      document.querySelector('#eval-student').value = draftToRestore.estudiante || '';
      document.querySelector('#eval-feedback').value = draftToRestore.retroalimentacion || '';
      rubricState = draftToRestore.criterios || {};
      draftToRestore = null;
      renderRubric();
    }
    refreshEvalContext();
    refreshStudentView();
  }
  function refreshEvalContext() {
    var subject = document.querySelector('#eval-subject').value;
    var item = subjects.find(function (s) { return s.name === subject; });
    document.querySelector('#eval-subject-context').innerHTML = item
      ? '<div><small>Semestre detectado</small><span>' + esc(item.semester === 'Flex' ? 'Flexible' : 'Semestre ' + item.semester) + '</span></div><div><small>Mapeo de CORA</small><span>' + ['ra1', 'ra2'].filter(function (k) { return item[k]; }).map(function (k) { return k.toUpperCase() + ' · ' + item[k] + ' (' + (item[k] === 'INTRODUCE' ? '33 %' : item[k] === 'REFUERZA' ? '66 %' : '100 %') + ')'; }).join(' · ') + '</span></div><div><small>Código de actividad</small><span>P2-SE · Sesión de ejercicio o entrenamiento</span></div>'
      : '<div>Seleccione una asignatura para consultar su mapeo.</div>';
  }
  function rangeText(range) { return range[0] === range[1] ? range[0].toFixed(1) : range[0].toFixed(1) + '–' + range[1].toFixed(1); }
  function renderRubric() {
    var levels = C.NIVELES;
    document.querySelector('#eval-rubric').innerHTML = rubric.map(function (criterion) {
      var value = rubricState[criterion.id];
      var levelButtons = levels.map(function (level, k) {
        return '<button type="button" class="ra-opcion" aria-pressed="' + Boolean(value && value.level === k) + '" data-rubric-action="level" data-criterion="' + criterion.id + '" data-index="' + k + '" aria-label="' + esc(criterion.nombre + ', ' + level.nombre + ': ' + criterion.descriptores[k]) + '"><span class="ra-opcion__nivel">' + esc(level.nombre) + '</span><span>' + esc(criterion.descriptores[k]) + '</span></button>';
      }).join('');
      var levelsControl = value
        ? '<span class="ra-subnivel__rotulo">Subnivel en ' + esc(levels[value.level].nombre) + '</span>' + levels[value.level].subniveles.map(function (range, k) {
            return '<button type="button" class="ra-chip" aria-pressed="' + (C.subnivel(value.note).indiceSubnivel === k) + '" data-rubric-action="sublevel" data-criterion="' + criterion.id + '" data-value="' + range[1] + '">' + rangeText(range) + '</button>';
          }).join('') + '<span class="ra-subnivel__espacio"></span><button type="button" class="ra-paso" data-rubric-action="minus" data-criterion="' + criterion.id + '" aria-label="Disminuir nota de ' + esc(criterion.nombre) + '">−</button><span class="ra-paso__valor">' + value.note.toFixed(1) + '</span><button type="button" class="ra-paso" data-rubric-action="plus" data-criterion="' + criterion.id + '" aria-label="Aumentar nota de ' + esc(criterion.nombre) + '">+</button>'
        : '<span class="ra-subnivel__rotulo">Seleccione un nivel para habilitar los subniveles.</span>';
      return '<article class="ra-criterio"><div class="ra-rubrica__fila"><div class="ra-criterio__nombre"><span class="ra-criterio__pregunta">' + esc(criterion.pregunta) + '</span><strong class="ra-criterio__titulo">' + esc(criterion.nombre) + '</strong><span class="ra-criterio__detalle">' + esc(criterion.detalle) + '</span><span class="ra-criterio__peso">Peso ' + criterion.peso + ' %</span></div>' + levelButtons + '</div><div class="ra-subnivel">' + levelsControl + '</div></article>';
    }).join('');
    var result = C.notaInstrumento(rubric.map(function (criterion) { return { peso: criterion.peso, nota: rubricState[criterion.id] ? rubricState[criterion.id].note : null }; }));
    document.querySelector('#eval-rubric-calc').innerHTML = rubric.map(function (criterion) {
      var value = rubricState[criterion.id];
      return '<tr><td>' + esc(criterion.nombre) + '</td><td>' + criterion.peso + ' %</td><td>' + (value ? value.note.toFixed(1) : '—') + '</td><td>' + (value ? (value.note * criterion.peso / 100).toFixed(2) : '—') + '</td></tr>';
    }).join('');
    document.querySelector('#eval-score').textContent = result.nota === null ? '—' : result.nota.toFixed(1);
    document.querySelector('#eval-exact-score').textContent = result.exacta === null ? '' : 'Exacta ' + result.exacta.toFixed(2);
    document.querySelector('#eval-level').textContent = result.nota === null ? 'Sin registro' : C.nivelDesempeno(result.nota).nombre;
    document.querySelector('#eval-level').setAttribute('data-nivel', result.nota === null ? 'sin-registro' : C.nivelDesempeno(result.nota).id);
    document.querySelector('#eval-provisional').hidden = result.completo;
    document.querySelector('#eval-register').disabled = !result.completo;
  }
  function setRubricValue(id, level, note) {
    rubricState[id] = { level: level, note: C.redondear(note, 1) };
    document.querySelector('#eval-message').hidden = true;
    renderRubric();
  }
  document.querySelector('#eval-rubric').addEventListener('click', function (event) {
    var button = event.target.closest('button[data-rubric-action]');
    if (!button) return;
    var id = button.dataset.criterion, action = button.dataset.rubricAction, value = rubricState[id];
    if (action === 'level') {
      var level = Number(button.dataset.index);
      setRubricValue(id, level, C.NIVELES[level].subniveles[1][1]);
    } else if (action === 'sublevel' && value) setRubricValue(id, value.level, Number(button.dataset.value));
    else if ((action === 'plus' || action === 'minus') && value) {
      var band = C.NIVELES[value.level], delta = action === 'plus' ? .1 : -.1;
      setRubricValue(id, value.level, Math.max(band.minimo, Math.min(band.maximo, C.redondear(value.note + delta, 1))));
    }
  });
  ['#eval-period', '#eval-subject', '#eval-student'].forEach(function (selector) {
    document.querySelector(selector).addEventListener('change', function () { refreshEvalContext(); });
  });
  document.querySelector('#eval-subject').addEventListener('change', refreshEvalContext);
  document.querySelector('#eval-draft').addEventListener('click', function () {
    var draft = { periodo: document.querySelector('#eval-period').value, asignatura: document.querySelector('#eval-subject').value, estudiante: document.querySelector('#eval-student').value.trim(), criterios: rubricState, retroalimentacion: document.querySelector('#eval-feedback').value };
    localStorage.setItem('cora-rubrica-borrador-v1', JSON.stringify(draft));
    document.querySelector('#eval-message').textContent = 'Borrador guardado solo en este navegador.';
    document.querySelector('#eval-message').hidden = false;
  });
  document.querySelector('#eval-register').addEventListener('click', function () {
    var student = document.querySelector('#eval-student').value.trim();
    var result = C.notaInstrumento(rubric.map(function (criterion) { return { peso: criterion.peso, nota: rubricState[criterion.id] ? rubricState[criterion.id].note : null }; }));
    if (!student || !document.querySelector('#eval-subject').value || !result.completo) {
      document.querySelector('#eval-message').textContent = 'Complete el nombre, la asignatura y los tres criterios antes de registrar.';
      document.querySelector('#eval-message').hidden = false;
      return;
    }
    window.coraAddRow({ asignatura: document.querySelector('#eval-subject').value, estudiante: student, actividad: 'Sesión terapéutica', codigoActividad: 'P2-SE', instrumento: 'Rúbrica analítica CORA', nota: String(result.nota), periodo: document.querySelector('#eval-period').value, retroalimentacion: document.querySelector('#eval-feedback').value, sourceFile: 'Evaluación CORA' });
    localStorage.removeItem('cora-rubrica-borrador-v1');
    draftToRestore = null;
    document.querySelector('#eval-message').textContent = 'Evaluación registrada. La nota se agregó a los resultados usando el mapeo curricular vigente.';
    document.querySelector('#eval-message').hidden = false;
    document.querySelector('#eval-student').value = '';
    document.querySelector('#eval-feedback').value = '';
    rubricState = {};
    renderRubric();
  });

  function renderAttitude() {
    document.querySelector('#att-criteria').innerHTML = attitudeCriteria.map(function (criterion, i) {
      return '<fieldset class="ra-escala-rapida"><legend>' + esc(criterion) + '</legend><div class="att-options">' + C.NIVELES.map(function (level, k) {
        return '<button type="button" class="ra-chip" aria-pressed="' + (attitudeState[i] === k) + '" data-attitude-index="' + i + '" data-attitude-level="' + k + '">' + esc(level.nombre) + '</button>';
      }).join('') + '</div></fieldset>';
    }).join('');
    var completed = attitudeState.filter(function (value) { return value !== null; }).length;
    var scores = attitudeState.map(function (index) { return index === null ? null : C.NIVELES[index].subniveles[1][1]; });
    var preview = C.promedioPonderado(scores.map(function (note) { return { peso: 1, nota: note }; }));
    document.querySelector('#att-progress').textContent = completed + ' de ' + attitudeCriteria.length + ' criterios valorados' + (preview.nota === null ? '' : ' · Nota preliminar ' + preview.nota.toFixed(1));
    document.querySelector('#att-register').disabled = completed !== attitudeCriteria.length;
  }
  document.querySelector('#att-criteria').addEventListener('click', function (event) {
    var button = event.target.closest('button[data-attitude-index]');
    if (!button) return;
    attitudeState[Number(button.dataset.attitudeIndex)] = Number(button.dataset.attitudeLevel);
    renderAttitude();
  });
  document.querySelector('[data-group="att-agent"]').addEventListener('click', function (event) {
    var button = event.target.closest('button[data-agent]');
    if (!button) return;
    agent = button.dataset.agent;
    this.querySelectorAll('button').forEach(function (item) { item.setAttribute('aria-pressed', String(item === button)); });
  });
  document.querySelector('#att-register').addEventListener('click', function () {
    var student = document.querySelector('#att-student').value.trim();
    if (!student || !document.querySelector('#att-subject').value || !document.querySelector('#att-period').value || attitudeState.some(function (value) { return value === null; })) {
      document.querySelector('#att-message').textContent = 'Complete el nombre, la asignatura y los cuatro criterios antes de registrar.';
      document.querySelector('#att-message').hidden = false;
      return;
    }
    var score = C.notaActitudinal((function () { var agentScore = attitudeState.reduce(function (sum, level) { return sum + C.NIVELES[level].subniveles[1][1]; }, 0) / attitudeState.length; var values = { DOC:null, PAR:null, EST:null }; values[agent] = agentScore; return values; })()).nota;
    var labels = { DOC:'Docente', PAR:'Par', EST:'Autoevaluación' };
    window.coraAddRow({ asignatura: document.querySelector('#att-subject').value, estudiante: student, actividad: 'Valoración actitudinal · ' + labels[agent], codigoActividad: 'A', instrumento: 'Dominio actitudinal · ' + agent, nota: String(score), periodo: document.querySelector('#att-period').value, observacion: document.querySelector('#att-observation').value, agente: agent, sourceFile: 'Registro actitudinal CORA' });
    attitudeState = [null, null, null, null];
    document.querySelector('#att-student').value = '';
    document.querySelector('#att-observation').value = '';
    document.querySelector('#att-message').textContent = 'Valoración registrada y agregada a CORA como evidencia actitudinal.';
    document.querySelector('#att-message').hidden = false;
    renderAttitude();
  });

  function refreshStudentView() {
    if (!window.coraGetStudentData) return;
    var data = window.coraGetStudentData();
    var names = Array.from(new Set(data.map(function (item) { return item.estudiante; }))).sort(function (a, b) { return a.localeCompare(b, 'es'); });
    var studentSelect = document.querySelector('#student-select'), oldName = studentSelect.value;
    setOptions('#student-select', names, oldName, names.length ? 'Seleccione un estudiante' : 'No hay estudiantes con evidencia válida');
    var periods = Array.from(new Set(data.map(function (item) { return item.periodo; }))).sort();
    var periodSelect = document.querySelector('#student-period'), oldPeriod = periodSelect.value;
    setOptions('#student-period', periods, oldPeriod, 'Todos los periodos');
    var student = studentSelect.value, period = periodSelect.value;
    var selected = data.filter(function (item) { return item.estudiante === student && (!period || item.periodo === period); });
    var buckets = new Map();
    selected.forEach(function (item) {
      var key = [item.periodo, item.semestre, item.ra].join('|');
      if (!buckets.has(key)) buckets.set(key, { periodo:item.periodo, semestre:item.semestre, ra:item.ra, sum:0, count:0, aporte:0 });
      var bucket = buckets.get(key); bucket.sum += item.porcentaje; bucket.count++; bucket.aporte += item.factor;
    });
    var grouped = Array.from(buckets.values()).map(function (item) { return Object.assign(item, { porcentaje:item.sum/item.count, promedioAporte:item.aporte/item.count }); }).sort(function (a, b) { return a.periodo.localeCompare(b.periodo) || String(a.semestre).localeCompare(String(b.semestre), 'es', {numeric:true}) || a.ra.localeCompare(b.ra); });
    var labels = Array.from(new Set(grouped.map(function (item) { return item.periodo + ' · ' + (item.semestre === 'Flex' ? 'Flex' : 'S' + item.semestre); })));
    var points = grouped.map(function (item) { return Object.assign({}, item, { label:item.periodo + ' · ' + (item.semestre === 'Flex' ? 'Flex' : 'S' + item.semestre), percent:item.porcentaje }); });
    window.coraLineChart('#student-ra-chart', points, labels);
    document.querySelector('#student-table').innerHTML = grouped.length ? grouped.map(function (item) { return '<tr><td>' + esc(item.periodo) + '</td><td>' + esc(item.semestre === 'Flex' ? 'Flexible' : 'Semestre ' + item.semestre) + '</td><td><strong>' + esc(item.ra) + '</strong></td><td><strong>' + item.porcentaje.toFixed(1) + ' %</strong></td><td>' + item.count + '</td><td>' + item.promedioAporte.toFixed(2) + '</td></tr>'; }).join('') : '<tr><td colspan="6" class="muted">Seleccione un estudiante con registros válidos mapeados.</td></tr>';
    document.querySelector('#student-summary').textContent = selected.length ? student + ' · ' + selected.length + ' evidencias alineadas incluidas en esta vista. La consulta se calcula con los registros válidos del navegador.' : 'Los nombres y notas se leen de los archivos que cargó y permanecen en este navegador.';
  }
  document.querySelector('#student-select').addEventListener('change', refreshStudentView);
  document.querySelector('#student-period').addEventListener('change', refreshStudentView);
  window.coraRefreshFeatures = refreshFormOptions;
  renderRubric();
  renderAttitude();
  document.querySelectorAll('[data-open-view]').forEach(function (button) {
    button.addEventListener('click', function () { var target = document.querySelector('.nav-item[data-view="' + button.dataset.openView + '"]'); if (target) target.click(); });
  });
})();
