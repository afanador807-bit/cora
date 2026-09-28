/* Explorador neuronal ligero: SVG nativo, sin dependencias ni servidor. */
(() => {
  const data = window.CORA_CURRICULAR_NETWORK;
  if (!data) return;

  const $ = (selector) => document.querySelector(selector);
  const normalizeText = (value) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const semesterNumber = (value) => String(value).toLowerCase() === 'flexible' ? 10.5 : Number(value) || 0;
  const semesterText = (value) => String(value).toLowerCase() === 'flexible' ? 'Flexible' : `Semestre ${value}`;
  const levelText = (value) => ({ INTRODUCE: 'Introduce', REFUERZA: 'Refuerza', DOMINA: 'Domina' }[value] || value || '');
  const typeSlug = (value) => normalizeText(value).replace(/\s+/g, '-');
  const subjectData = [...data.asignaturas].sort((a, b) => semesterNumber(a.semestre) - semesterNumber(b.semestre) || a.nombre.localeCompare(b.nombre, 'es'));
  const subjectByCode = new Map(subjectData.map((item) => [item.sigla, item]));
  const curriculumByName = new Map(MOTOR_RA_MAPEO.subjects.map((item) => [normalizeText(item.name), item]));
  const graph = { nodes: [], links: [], nodeById: new Map() };
  let focusId = 'asignatura:BIOF';
  let graphDepth = 2;
  let graphDirection = 'ambas';
  let graphLayout = 'organica';
  let zoom = { scale: 1, x: 0, y: 0 };
  let pointerStart = null;
  let movedPointer = false;
  let graphWasInitialized = false;

  function addNode(node) {
    graph.nodes.push(node);
    graph.nodeById.set(node.id, node);
  }

  for (const subject of subjectData) {
    const courseMap = curriculumByName.get(normalizeText(subject.nombre));
    addNode({
      id: `asignatura:${subject.sigla}`, kind: 'asignatura', code: subject.sigla,
      name: subject.nombre, short: subject.sigla, semester: subject.semestre,
      credits: subject.creditos, group: subject.eje_tematico || '', data: subject,
    });
  }
  for (const item of data.competencias) addNode({ id: `competencia:${item.codigo}`, kind: 'competencia', code: item.codigo, name: item.descripcion, short: item.codigo, data: item });
  for (const item of data.perfil_egreso) addNode({ id: `perfil:${item.codigo}`, kind: 'perfil', code: item.codigo, name: item.descripcion, short: item.codigo, data: item });
  for (const code of ['RA1', 'RA2']) addNode({ id: `ra:${code}`, kind: 'ra', code, name: `Resultado de aprendizaje ${code.slice(-1)}`, short: code, data: { codigo: code } });

  function addLink(link) { graph.links.push({ id: `link-${graph.links.length + 1}`, ...link }); }
  for (const relation of data.relaciones) {
    addLink({
      from: `asignatura:${relation.sigla_origen}`, to: `asignatura:${relation.sigla_destino}`,
      kind: 'asignatura', type: relation.tipo, direction: relation.direccion,
      intensity: relation.intensidad, rationale: relation.justificacion,
    });
  }
  for (const subject of subjectData) {
    const courseMap = curriculumByName.get(normalizeText(subject.nombre));
    for (const [key, code] of [['ra1', 'RA1'], ['ra2', 'RA2']]) {
      const level = courseMap?.[key];
      if (level && level !== 'SIN_APORTE') addLink({ from: `asignatura:${subject.sigla}`, to: `ra:${code}`, kind: 'curricular', layer: 'ra', type: `Tributa a ${code}`, level: levelText(level) });
    }
    for (const [code, level] of Object.entries(subject.competencias || {})) {
      if (level !== 'Sin aporte') addLink({ from: `asignatura:${subject.sigla}`, to: `competencia:${code}`, kind: 'curricular', layer: 'competencia', type: 'Aporta a competencia', level });
    }
    for (const [code, level] of Object.entries(subject.perfil_egreso || {})) {
      if (level !== 'Sin aporte') addLink({ from: `asignatura:${subject.sigla}`, to: `perfil:${code}`, kind: 'curricular', layer: 'perfil', type: 'Alinea con perfil', level });
    }
  }

  function initControls() {
    const subjectSelect = $('#network-subject');
    if (!subjectSelect) return;
    subjectSelect.innerHTML = subjectData.map((item) => `<option value="asignatura:${escapeHtml(item.sigla)}">${escapeHtml(semesterText(item.semestre))} · ${escapeHtml(item.nombre)}</option>`).join('');
    $('#network-type').innerHTML = '<option value="Todas">Todas las relaciones</option>' + Object.keys(data.tipos_relacion).map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('');
    const semesters = [...new Set(subjectData.map((item) => String(item.semestre)))].sort((a, b) => semesterNumber(a) - semesterNumber(b));
    $('#network-neighbor-semester').innerHTML = '<option value="Todos">Todos los semestres</option>' + semesters.map((semester) => `<option value="${escapeHtml(semester)}">${escapeHtml(semesterText(semester))}</option>`).join('');
    subjectSelect.value = focusId;
    if (window.matchMedia('(max-width: 760px)').matches) $('#network-inspector').open = false;
    subjectSelect.onchange = () => setFocus(subjectSelect.value);
    $('#network-type').onchange = renderNetwork;
    $('#network-neighbor-semester').onchange = renderNetwork;
    $('#network-direction').onchange = (event) => { graphDirection = event.target.value; renderNetwork(); };
    $('#network-layout').onchange = (event) => { graphLayout = event.target.value; zoom = { scale: 1, x: 0, y: 0 }; renderNetwork(); };
    $('#network-depth').oninput = (event) => { graphDepth = Number(event.target.value); $('#network-depth-value').value = String(graphDepth); $('#network-depth-value').textContent = String(graphDepth); renderNetwork(); };
    $('#network-reset').onclick = () => { setFocus('asignatura:BIOF'); $('#network-type').value = 'Todas'; $('#network-neighbor-semester').value = 'Todos'; $('#network-direction').value = 'ambas'; $('#network-layout').value = 'organica'; $('#network-depth').value = '2'; $('#network-depth-value').value = '2'; $('#network-depth-value').textContent = '2'; document.querySelectorAll('[data-network-layer]').forEach((input) => { input.checked = true; }); graphDirection = 'ambas'; graphLayout = 'organica'; zoom = { scale: 1, x: 0, y: 0 }; renderNetwork(); };
    document.querySelectorAll('[data-network-layer]').forEach((input) => input.addEventListener('change', renderNetwork));
    $('#network-zoom-in').onclick = () => changeZoom(1.18);
    $('#network-zoom-out').onclick = () => changeZoom(1 / 1.18);
    document.querySelectorAll('.nav-item[data-view="interconexion"]').forEach((button) => button.addEventListener('click', () => requestAnimationFrame(renderNetwork)));
    if ('ResizeObserver' in window) new ResizeObserver(() => renderNetwork()).observe($('#curricular-network'));
    else window.addEventListener('resize', renderNetwork, { passive: true });
  }

  function setFocus(id) {
    if (!graph.nodeById.has(id)) return;
    focusId = id;
    zoom = { scale: 1, x: 0, y: 0 };
    if (graph.nodeById.get(id).kind === 'asignatura') $('#network-subject').value = id;
    if (window.matchMedia('(max-width: 760px)').matches) $('#network-inspector').open = true;
    renderNetwork();
  }

  function linkVisible(link) {
    if (!graph.nodeById.has(link.from) || !graph.nodeById.has(link.to)) return false;
    if (link.kind === 'asignatura') {
      if ($('#network-type').value !== 'Todas' && link.type !== $('#network-type').value) return false;
      const semesterFilter = $('#network-neighbor-semester').value;
      if (semesterFilter !== 'Todos') {
        const a = graph.nodeById.get(link.from), b = graph.nodeById.get(link.to);
        if (String(a.semester) !== semesterFilter && String(b.semester) !== semesterFilter) return false;
      }
    }
    if (link.layer && !document.querySelector(`[data-network-layer="${link.layer}"]`)?.checked) return false;
    return true;
  }

  function traversable(link, currentId) {
    if (link.kind !== 'asignatura' || link.direction === 'Horizontal' || graphDirection === 'ambas') return true;
    if (graphDirection === 'aguas-abajo') return currentId === link.from;
    if (graphDirection === 'aguas-arriba') return currentId === link.to;
    return true;
  }

  function traceNetwork() {
    const visible = new Map([[focusId, 0]]), frontier = [focusId];
    for (let depth = 1; depth <= graphDepth; depth += 1) {
      const next = [];
      for (const current of frontier) {
        for (const link of graph.links) {
          if (!linkVisible(link) || !traversable(link, current)) continue;
          const neighbor = link.from === current ? link.to : link.to === current ? link.from : null;
          if (neighbor && !visible.has(neighbor)) { visible.set(neighbor, depth); next.push(neighbor); }
        }
      }
      frontier.splice(0, frontier.length, ...next);
      if (!frontier.length) break;
    }
    return {
      distances: visible,
      nodes: [...visible.keys()].map((id) => graph.nodeById.get(id)),
      links: graph.links.filter((link) => linkVisible(link) && visible.has(link.from) && visible.has(link.to)),
    };
  }

  function nodeRadius(node) { return node.kind === 'asignatura' ? (node.id === focusId ? 20 : 12 + Math.min(4, Math.sqrt(node.credits || 1))) : node.kind === 'ra' ? 17 : 14; }
  function sortNode(a, b) { return (a.kind === 'asignatura' ? semesterNumber(a.semester) : 50) - (b.kind === 'asignatura' ? semesterNumber(b.semester) : 50) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'es'); }

  function radialPositions(nodes, links, width, height, distances) {
    const cx = width / 2, cy = height / 2, minSize = Math.min(width, height), positions = new Map();
    const groups = new Map();
    for (const node of nodes) { const depth = distances.get(node.id); if (!groups.has(depth)) groups.set(depth, []); groups.get(depth).push(node); }
    for (const [depth, group] of groups) {
      group.sort(sortNode);
      group.forEach((node, index) => {
        if (depth === 0) { positions.set(node.id, { x: cx, y: cy, tx: cx, ty: cy }); return; }
        const angle = (Math.PI * 2 * index / Math.max(1, group.length)) - Math.PI / 2 + (depth % 2 ? 0.11 : -0.13);
        const radius = Math.min(minSize * 0.44, minSize * (0.14 + depth * 0.16));
        const x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius;
        positions.set(node.id, { x, y, tx: x, ty: y });
      });
    }
    const movable = nodes.filter((node) => node.id !== focusId);
    for (let tick = 0; tick < 72; tick += 1) {
      const cooling = 1 - tick / 90;
      for (let i = 0; i < movable.length; i += 1) for (let j = i + 1; j < movable.length; j += 1) {
        const a = positions.get(movable[i].id), b = positions.get(movable[j].id), dx = b.x - a.x, dy = b.y - a.y, length = Math.max(0.01, Math.hypot(dx, dy));
        const desired = nodeRadius(movable[i]) + nodeRadius(movable[j]) + (width < 600 ? 12 : 18);
        if (length < desired) { const push = (desired - length) * 0.018 * cooling, px = dx / length * push, py = dy / length * push; a.x -= px; a.y -= py; b.x += px; b.y += py; }
      }
      for (const node of movable) {
        const p = positions.get(node.id); p.x += (p.tx - p.x) * 0.035; p.y += (p.ty - p.y) * 0.035;
        const pad = nodeRadius(node) + 22; p.x = Math.max(pad, Math.min(width - pad, p.x)); p.y = Math.max(pad + 24, Math.min(height - pad, p.y));
      }
    }
    return positions;
  }

  function semesterPositions(nodes, width, height, distances) {
    const positions = new Map(), subjects = nodes.filter((node) => node.kind === 'asignatura').sort(sortNode), layers = nodes.filter((node) => node.kind !== 'asignatura');
    const semesters = [...new Set(subjects.map((node) => String(node.semester)))].sort((a, b) => semesterNumber(a) - semesterNumber(b));
    const margin = 58, usable = width - margin * 2;
    semesters.forEach((semester, index) => {
      const group = subjects.filter((node) => String(node.semester) === semester);
      const x = margin + (semesters.length < 2 ? usable / 2 : index * usable / (semesters.length - 1));
      group.forEach((node, i) => { const y = 104 + i * 48; positions.set(node.id, { x, y, tx: x, ty: y }); });
    });
    const classes = ['ra', 'competencia', 'perfil'];
    classes.forEach((kind, column) => {
      const group = layers.filter((node) => node.kind === kind).sort((a, b) => a.code.localeCompare(b.code, 'es'));
      group.forEach((node, i) => { const x = 80 + i * (width - 160) / Math.max(1, group.length - 1), y = height - 300 + column * 105; positions.set(node.id, { x, y, tx: x, ty: y }); });
    });
    return positions;
  }

  function shortLabel(node) {
    if (node.kind === 'asignatura') return `${node.short} · S${String(node.semester).toLowerCase() === 'flexible' ? 'F' : node.semester}`;
    return node.short;
  }

  function edgeMarkup(link, positions, distances) {
    const a = positions.get(link.from), b = positions.get(link.to);
    if (!a || !b) return '';
    const from = graph.nodeById.get(link.from), to = graph.nodeById.get(link.to);
    const activeDepth = Math.max(distances.get(link.from) || 0, distances.get(link.to) || 0);
    const typeClass = link.kind === 'asignatura' ? `network-edge--${typeSlug(link.type)}` : `network-edge--${link.layer}`;
    const arrow = link.direction === 'Horizontal' ? ' marker-start="url(#neural-arrow)" marker-end="url(#neural-arrow)"' : ' marker-end="url(#neural-arrow)"';
    const title = link.kind === 'asignatura' ? `${from.name} → ${to.name} · ${link.type} · Intensidad ${link.intensity} · ${link.rationale}` : `${from.name} → ${to.name} · ${link.type} · ${link.level}`;
    return `<line class="neural-edge ${typeClass} neural-depth-${activeDepth}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"${arrow}><title>${escapeHtml(title)}</title></line>`;
  }

  function nodeMarkup(node, position, depth) {
    const radius = nodeRadius(node), focus = node.id === focusId, layerClass = node.kind === 'asignatura' ? 'course' : node.kind;
    const short = shortLabel(node);
    const subline = node.kind === 'asignatura' ? `${node.credits} cr` : node.kind === 'competencia' ? node.data.grupo.replace('Competencias del programa (PEP 2021)', 'Programa') : '';
    const title = node.kind === 'asignatura' ? `${node.name} · ${semesterText(node.semester)} · ${node.credits} créditos` : `${node.code} · ${node.name}`;
    return `<g class="neural-node neural-node--${layerClass} neural-depth-${depth}${focus ? ' is-focus' : ''}" data-network-id="${escapeHtml(node.id)}" tabindex="0" role="button" aria-label="Explorar ${escapeHtml(title)}" transform="translate(${position.x} ${position.y})"><title>${escapeHtml(title)}</title><circle class="neural-halo" r="${radius + (focus ? 11 : 5)}"></circle><circle class="neural-core" r="${radius}"></circle><text class="neural-node-label" text-anchor="middle" y="${radius + 14}">${escapeHtml(short)}</text>${subline ? `<text class="neural-node-sub" text-anchor="middle" y="${radius + 25}">${escapeHtml(subline)}</text>` : ''}</g>`;
  }

  function renderNetwork() {
    if (!$('#curricular-network')) return;
    const target = $('#curricular-network'), traced = traceNetwork(), width = graphLayout === 'semestres' ? Math.max(1080, target.clientWidth) : Math.max(340, target.clientWidth || 820);
    const maxCoursesInSemester = Math.max(1, ...[...new Set(traced.nodes.filter((node) => node.kind === 'asignatura').map((node) => String(node.semester)))].map((semester) => traced.nodes.filter((node) => node.kind === 'asignatura' && String(node.semester) === semester).length));
    const height = graphLayout === 'semestres' ? Math.max(820, maxCoursesInSemester * 48 + 450) : Math.max(520, Math.min(760, window.innerHeight * 0.7));
    const positions = graphLayout === 'semestres' ? semesterPositions(traced.nodes, width, height, traced.distances) : radialPositions(traced.nodes, traced.links, width, height, traced.distances);
    const labels = graphLayout === 'semestres' ? `<g class="neural-time-axis">${[...new Set(traced.nodes.filter((n) => n.kind === 'asignatura').map((n) => String(n.semester)))].sort((a, b) => semesterNumber(a) - semesterNumber(b)).map((semester) => { const group = traced.nodes.filter((n) => n.kind === 'asignatura' && String(n.semester) === semester), x = positions.get(group[0]?.id)?.x || 0; return `<text x="${x}" y="34" text-anchor="middle">${escapeHtml(String(semester).toLowerCase() === 'flexible' ? 'Flex' : `S${semester}`)}</text>`; }).join('')}</g>` : '';
    const svg = `<svg class="neural-svg${graphLayout === 'semestres' ? ' neural-svg--timeline' : ''}" viewBox="0 0 ${width} ${height}" role="group" aria-label="Red neuronal curricular, foco en ${escapeHtml(graph.nodeById.get(focusId)?.name || '')}"><defs><marker id="neural-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="neural-arrow-head"></path></marker></defs><g class="network-world" transform="translate(${zoom.x} ${zoom.y}) scale(${zoom.scale})">${labels}${traced.links.map((link) => edgeMarkup(link, positions, traced.distances)).join('')}${traced.nodes.map((node) => nodeMarkup(node, positions.get(node.id), traced.distances.get(node.id))).join('')}</g></svg>`;
    target.innerHTML = svg;
    const focus = graph.nodeById.get(focusId), assignment = subjectByCode.get(focus?.code);
    const nodeCount = traced.nodes.length, edgeCount = traced.links.length;
    $('#network-summary').innerHTML = `<span class="network-summary__focus">${escapeHtml(focus?.name || '')}</span><span>${nodeCount} nodos</span><span>${edgeCount} conexiones</span><span>Alcance ${graphDepth}</span>`;
    $('#network-inspector-title').textContent = `${focus?.code || ''} · ${focus?.name || 'Nodo curricular'}`;
    renderInspector(focus, assignment);
  }

  function relatedCourseLinks(focus) {
    if (!focus) return [];
    const items = graph.links.filter((link) => link.kind === 'asignatura' && linkVisible(link) && (link.from === focus.id || link.to === focus.id)).map((link) => ({ link, other: graph.nodeById.get(link.from === focus.id ? link.to : link.from) }));
    return items.sort((a, b) => semesterNumber(a.other.semester) - semesterNumber(b.other.semester) || a.other.name.localeCompare(b.other.name, 'es') || a.link.type.localeCompare(b.link.type, 'es'));
  }

  function contributionLinks(focus) {
    return focus ? graph.links.filter((link) => link.kind === 'curricular' && (link.from === focus.id || link.to === focus.id)) : [];
  }

  function renderInspector(focus, assignment) {
    const relationItems = focus?.kind === 'asignatura' ? relatedCourseLinks(focus) : [];
    $('#network-relation-count').textContent = `${relationItems.length} asignaturas relacionadas`;
    $('#network-relations').innerHTML = relationItems.length ? relationItems.map(({ link, other }) => `<article class="network-relation"><button type="button" class="network-relation__open" data-focus-network="${escapeHtml(other.id)}"><span class="network-semester-tag">${escapeHtml(semesterText(other.semester))}</span><strong>${escapeHtml(other.name)}</strong><span class="badge network-type">${escapeHtml(link.type)}</span><span class="badge network-strength">${escapeHtml(link.intensity)}</span><small>${link.direction === 'Horizontal' ? 'Articulación simultánea' : `${escapeHtml(link.from === focus.id ? 'Habilita' : 'Se fundamenta en')} · ${escapeHtml(link.direction)}`}</small><span class="network-relation__rationale">${escapeHtml(link.rationale)}</span></button></article>`).join('') : `<p class="muted">${focus?.kind === 'asignatura' ? 'No tiene relaciones directas con asignaturas en los filtros actuales.' : 'Elige una asignatura relacionada para ver su secuencia curricular.'}</p>`;
    if (focus?.kind === 'asignatura' && assignment) {
      const links = contributionLinks(focus), kinds = [['RA', 'ra'], ['Competencias', 'competencia'], ['Perfil de egreso', 'perfil']];
      $('#network-mappings').innerHTML = kinds.map(([title, kind]) => { const entries = links.filter((link) => link.layer === kind).sort((a, b) => a.to.localeCompare(b.to)); return `<section class="network-mapping-group"><h4>${title}<span>${entries.length}</span></h4>${entries.length ? entries.map((link) => { const node = graph.nodeById.get(link.to); return `<button type="button" class="network-mapping-link" data-focus-network="${escapeHtml(link.to)}"><strong>${escapeHtml(node.code)}</strong><span>${escapeHtml(node.name)}</span><b>${escapeHtml(link.level)}</b></button>`; }).join('') : '<p class="muted">Sin aporte asociado.</p>'}</section>`; }).join('');
    } else {
      const related = graph.links.filter((link) => link.kind === 'curricular' && (link.from === focus?.id || link.to === focus?.id)).map((link) => graph.nodeById.get(link.from === focus.id ? link.to : link.from)).filter(Boolean).sort(sortNode);
      $('#network-mappings').innerHTML = `<section class="network-mapping-group"><h4>Asignaturas vinculadas<span>${related.length}</span></h4>${related.length ? related.map((node) => `<button type="button" class="network-mapping-link" data-focus-network="${escapeHtml(node.id)}"><strong>${escapeHtml(semesterText(node.semester))}</strong><span>${escapeHtml(node.name)}</span><b>${escapeHtml(node.credits)} créditos</b></button>`).join('') : '<p class="muted">Sin asignaturas vinculadas.</p>'}</section>`;
    }
  }

  function changeZoom(factor) { zoom.scale = Math.max(0.55, Math.min(2.4, zoom.scale * factor)); updateWorldTransform(); }
  function updateWorldTransform() { const world = $('#curricular-network .network-world'); if (world) world.setAttribute('transform', `translate(${zoom.x} ${zoom.y}) scale(${zoom.scale})`); }
  function onGraphClick(event) {
    if (movedPointer) { movedPointer = false; return; }
    const node = event.target.closest('[data-network-id]');
    if (node) setFocus(node.dataset.networkId);
    const link = event.target.closest('[data-focus-network]');
    if (link) setFocus(link.dataset.focusNetwork);
  }
  function onGraphKeydown(event) { const node = event.target.closest('[data-network-id]'); if (node && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setFocus(node.dataset.networkId); } }
  function onPointerDown(event) { if (event.target.closest('[data-network-id]')) return; pointerStart = { x: event.clientX, y: event.clientY, ox: zoom.x, oy: zoom.y }; movedPointer = false; event.currentTarget.setPointerCapture?.(event.pointerId); }
  function onPointerMove(event) { if (!pointerStart) return; const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y; if (Math.abs(dx) + Math.abs(dy) > 4) movedPointer = true; zoom.x = pointerStart.ox + dx; zoom.y = pointerStart.oy + dy; updateWorldTransform(); }
  function onPointerUp() { pointerStart = null; }
  function onGraphWheel(event) { event.preventDefault(); changeZoom(event.deltaY < 0 ? 1.08 : 1 / 1.08); }

  document.addEventListener('click', (event) => { const button = event.target.closest('[data-focus-network]'); if (button) setFocus(button.dataset.focusNetwork); });
  function bindPanZoomHandlers() {
    const canvas = $('#curricular-network');
    canvas.addEventListener('click', onGraphClick);
    canvas.addEventListener('keydown', onGraphKeydown);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onGraphWheel, { passive: false });
  }

  function render() { renderNetwork(); }
  window.CORA_CURRICULAR_UI = { render, setFocus };
  window.renderCurricularNetwork = render;
  initControls();
  bindPanZoomHandlers();
  renderNetwork();
  if ('ResizeObserver' in window) new ResizeObserver(() => renderNetwork()).observe($('#curricular-network'));
  document.querySelectorAll('.nav-item[data-view="interconexion"]').forEach((button) => button.addEventListener('click', () => requestAnimationFrame(renderNetwork)));
})();
