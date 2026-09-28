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
  let focusId = '';
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
    const subjectSelect = $('#network-subject'), mapSelect = $('#network-subject-map');
    if (!subjectSelect) return;
    const options = '<option value="">Busca una asignatura…</option>' + subjectData.map((item) => `<option value="asignatura:${escapeHtml(item.sigla)}">${escapeHtml(semesterText(item.semestre))} · ${escapeHtml(item.nombre)}</option>`).join('');
    subjectSelect.innerHTML = options; mapSelect.innerHTML = options;
    $('#network-type').innerHTML = '<option value="Todas">Todas las relaciones</option>' + Object.keys(data.tipos_relacion).map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('');
    const semesters = [...new Set(subjectData.map((item) => String(item.semestre)))].sort((a, b) => semesterNumber(a) - semesterNumber(b));
    $('#network-neighbor-semester').innerHTML = '<option value="Todos">Todos los semestres</option>' + semesters.map((semester) => `<option value="${escapeHtml(semester)}">${escapeHtml(semesterText(semester))}</option>`).join('');
    subjectSelect.value = '';
    $('#network-inspector').hidden = true;
    subjectSelect.onchange = () => { if (subjectSelect.value) setFocus(subjectSelect.value); };
    mapSelect.onchange = () => { if (mapSelect.value) setFocus(mapSelect.value); };
    $('#network-type').onchange = renderNetwork;
    $('#network-neighbor-semester').onchange = renderNetwork;
    $('#network-reset').onclick = () => { focusId = ''; subjectSelect.value = ''; mapSelect.value = ''; $('#network-type').value = 'Todas'; $('#network-neighbor-semester').value = 'Todos'; document.querySelectorAll('[data-network-layer]').forEach((input) => { input.checked = true; }); $('#network-welcome').hidden = false; $('#network-map-view').hidden = true; $('#network-inspector').hidden = true; renderNetwork(); };
    document.querySelectorAll('[data-network-layer]').forEach((input) => input.addEventListener('change', renderNetwork));
    document.querySelectorAll('.nav-item[data-view="interconexion"]').forEach((button) => button.addEventListener('click', () => requestAnimationFrame(renderNetwork)));
    if ('ResizeObserver' in window) new ResizeObserver(() => renderNetwork()).observe($('#curricular-network'));
    else window.addEventListener('resize', renderNetwork, { passive: true });
  }

  function setFocus(id) {
    if (!graph.nodeById.has(id)) return;
    if (graph.nodeById.get(id).kind !== 'asignatura') return;
    focusId = id;
    zoom = { scale: 1, x: 0, y: 0 };
    $('#network-subject').value = id; $('#network-subject-map').value = id;
    $('#network-welcome').hidden = true; $('#network-map-view').hidden = false; $('#network-inspector').hidden = false;
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
    const target = $('#curricular-network'); if (!target) return;
    if (!focusId) { target.innerHTML = ''; return; }
    const focus = graph.nodeById.get(focusId), assignment = subjectByCode.get(focus?.code);
    const links = graph.links.filter((link) => linkVisible(link) && (link.from === focusId || link.to === focusId));
    const nodes = new Map([[focusId, focus]]);
    links.forEach((link) => { const other = graph.nodeById.get(link.from === focusId ? link.to : link.from); if (other) nodes.set(other.id, other); });
    const nodeList = [...nodes.values()], width = Math.max(1480, target.clientWidth || 1480), competenceRows = Math.ceil(nodeList.filter((node) => node.kind === 'competencia').length / 5), profileRows = Math.ceil(nodeList.filter((node) => node.kind === 'perfil').length / 5), height = Math.max(980, 730 + competenceRows * 78 + profileRows * 42), center = { x: width / 2, y: Math.round(height * .56) }, positions = new Map([[focusId, center]]);
    const before = nodeList.filter((node) => node.kind === 'asignatura' && node.id !== focusId && semesterNumber(node.semester) < semesterNumber(focus.semester)).sort(sortNode);
    const after = nodeList.filter((node) => node.kind === 'asignatura' && node.id !== focusId && semesterNumber(node.semester) >= semesterNumber(focus.semester)).sort(sortNode);
    before.forEach((node, i) => positions.set(node.id, { x: width * 0.15, y: 300 + i * ((height - 450) / Math.max(1, before.length - 1)) }));
    after.forEach((node, i) => positions.set(node.id, { x: width * 0.85, y: 300 + i * ((height - 450) / Math.max(1, after.length - 1)) }));
    const groupNodes = (kind) => nodeList.filter((node) => node.kind === kind).sort((a, b) => a.code.localeCompare(b.code, 'es'));
    const competencies = groupNodes('competencia');
    competencies.forEach((node, i) => { const row = Math.floor(i / 5), col = i % 5, rowItems = competencies.slice(row * 5, row * 5 + 5); positions.set(node.id, { x: width * (col + 1) / (rowItems.length + 1), y: 88 + row * 78 }); });
    for (const node of groupNodes('ra')) positions.set(node.id, { x: width * (groupNodes('ra').indexOf(node) + 1) / (groupNodes('ra').length + 1), y: 405 });
    const profiles = groupNodes('perfil');
    profiles.forEach((node, i) => { const row = Math.floor(i / 5), col = i % 5, rowItems = profiles.slice(row * 5, row * 5 + 5); positions.set(node.id, { x: width * (col + 1) / (rowItems.length + 1), y: center.y + 235 + row * 80 }); });
    const connector = links.map((link) => { const a = positions.get(link.from), b = positions.get(link.to); if (!a || !b) return ''; return `<path class="mindmap-edge mindmap-edge--${link.kind === 'asignatura' ? typeSlug(link.type) : link.layer}" d="M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}" marker-end="url(#mind-arrow)"><title>${escapeHtml(link.kind === 'asignatura' ? `${graph.nodeById.get(link.from).name} → ${graph.nodeById.get(link.to).name} · ${link.type}` : `${graph.nodeById.get(link.from).name} → ${graph.nodeById.get(link.to).code} · ${link.level}`)}</title></path>`; }).join('');
    const shorten = (value, limit = 27) => String(value).length > limit ? `${String(value).slice(0, limit - 1).trim()}…` : value;
    const nodeHtml = nodeList.map((node) => { const p = positions.get(node.id), selected = node.id === focusId, kind = node.kind === 'asignatura' ? 'course' : node.kind, title = node.kind === 'asignatura' ? `${node.name} · ${semesterText(node.semester)} · ${node.credits} créditos` : `${node.code} · ${node.name}`, line = node.kind === 'asignatura' ? `${semesterText(node.semester)} · ${node.credits} créditos` : node.kind === 'ra' ? `${node.code} · ${links.find((link) => link.from === focusId && link.to === node.id)?.level || ''}` : node.kind === 'competencia' || node.kind === 'perfil' ? node.code : ''; const label = shorten(node.name, node.kind === 'asignatura' ? 30 : 24); const boxWidth = selected ? 230 : node.kind === 'asignatura' ? 210 : 180, boxHeight = selected ? 86 : node.kind === 'asignatura' ? 72 : node.kind === 'competencia' || node.kind === 'perfil' ? 80 : 60; return `<g class="mindmap-node mindmap-node--${kind}${selected ? ' is-focus' : ''}" data-network-id="${escapeHtml(node.id)}" tabindex="0" role="button" aria-label="Explorar ${escapeHtml(title)}" transform="translate(${p.x} ${p.y})"><title>${escapeHtml(title)}</title><rect x="${-boxWidth / 2}" y="${-boxHeight / 2}" width="${boxWidth}" height="${boxHeight}" rx="${selected ? 18 : 12}"/><text class="mindmap-code" y="${-boxHeight / 2 + 19}" text-anchor="middle">${escapeHtml(line)}</text><text class="mindmap-label" y="${node.kind === 'asignatura' ? 5 : 6}" text-anchor="middle">${escapeHtml(label)}</text>${node.kind !== 'asignatura' && node.kind !== 'ra' ? `<text class="mindmap-code" y="${boxHeight / 2 - 12}" text-anchor="middle">${escapeHtml(node.code)}</text>` : ''}</g>`; }).join('');
    const headers = `<g class="mindmap-headings"><text x="${width * .15}" y="34" text-anchor="middle">ASIGNATURAS PREVIAS</text><text x="${center.x}" y="34" text-anchor="middle">COMPETENCIAS</text><text x="${center.x}" y="368" text-anchor="middle">RESULTADOS DE APRENDIZAJE</text><text x="${center.x}" y="${center.y + 205}" text-anchor="middle">PERFIL DE EGRESO</text><text x="${width * .85}" y="34" text-anchor="middle">ASIGNATURAS QUE CONTINÚAN</text></g>`;
    target.innerHTML = `<svg class="neural-svg mindmap-svg" viewBox="0 0 ${width} ${height}" role="group" aria-label="Mapa mental de ${escapeHtml(focus.name)}"><defs><marker id="mind-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7893ad"/></marker></defs>${headers}${connector}${nodeHtml}</svg>`;
    $('#network-summary').innerHTML = `<span class="network-summary__focus">${escapeHtml(focus.name)}</span><span>${escapeHtml(semesterText(focus.semester))}</span><span>${links.length} vínculos curriculares directos</span>`;
    $('#network-inspector-title').textContent = `${focus.code} · ${focus.name}`;
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
