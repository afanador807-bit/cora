/**
 * Reglas de cálculo · Evaluación de Resultados de Aprendizaje
 * Departamento de Fisioterapia · Universidad del Cauca
 *
 * Fuente de verdad de la lógica evaluativa. Toda la interfaz debe
 * consumir estas funciones en lugar de reimplementar los cálculos.
 *
 * Funciona en el navegador (window.EvaluacionRA) y en Node (require).
 */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.EvaluacionRA = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Escala institucional de calificación. */
  var ESCALA = Object.freeze({ minimo: 0.0, maximo: 5.0, aprobatoria: 3.0 });

  /**
   * Cuatro niveles de desempeño con tres subniveles cada uno.
   * Los subniveles se expresan como rangos que cubren la totalidad de la banda.
   */
  var NIVELES = Object.freeze([
    { id: 'insuficiente', nombre: 'Insuficiente', minimo: 0.0, maximo: 2.9, subniveles: [[0.0, 0.9], [1.0, 1.9], [2.0, 2.9]] },
    { id: 'basico', nombre: 'Básico', minimo: 3.0, maximo: 3.9, subniveles: [[3.0, 3.3], [3.4, 3.6], [3.7, 3.9]] },
    { id: 'competente', nombre: 'Competente', minimo: 4.0, maximo: 4.5, subniveles: [[4.0, 4.1], [4.2, 4.3], [4.4, 4.5]] },
    { id: 'destacado', nombre: 'Destacado', minimo: 4.6, maximo: 5.0, subniveles: [[4.6, 4.7], [4.8, 4.9], [5.0, 5.0]] }
  ]);

  /** Ponderación de los dominios dentro de la nota de dominios. */
  var PESOS_DOMINIOS = Object.freeze({ actitudinal: 0.10, procedimental: 0.40, cognitivo: 0.50 });

  /** Composición de la nota de cada rotación. */
  var PESOS_ROTACION = Object.freeze({ dominios: 0.75, examen: 0.25 });

  /** Agentes del dominio actitudinal, todos con el mismo peso. */
  var AGENTES_ACTITUDINAL = Object.freeze(['DOC', 'PAR', 'EST']);

  function esNumero(v) { return typeof v === 'number' && isFinite(v); }

  /** Redondeo institucional a una cifra decimal (o a las indicadas). */
  function redondear(valor, decimales) {
    var d = decimales === undefined ? 1 : decimales;
    var f = Math.pow(10, d);
    return Math.round((valor + 1e-9) * f) / f;
  }

  function validarNota(nota) {
    if (!esNumero(nota) || nota < ESCALA.minimo || nota > ESCALA.maximo) {
      throw new RangeError('Nota fuera de la escala institucional (0.0 a 5.0): ' + nota);
    }
    return nota;
  }

  /** Devuelve el nivel de desempeño de una nota ya redondeada a un decimal. */
  function nivelDesempeno(nota) {
    var n = redondear(validarNota(nota), 1);
    for (var i = 0; i < NIVELES.length; i++) {
      if (n >= NIVELES[i].minimo - 1e-9 && n <= NIVELES[i].maximo + 1e-9) return NIVELES[i];
    }
    return null;
  }

  /** Devuelve { nivel, indiceSubnivel, rango } para una nota. */
  function subnivel(nota) {
    var nivel = nivelDesempeno(nota);
    var n = redondear(nota, 1);
    for (var i = 0; i < nivel.subniveles.length; i++) {
      var r = nivel.subniveles[i];
      if (n >= r[0] - 1e-9 && n <= r[1] + 1e-9) return { nivel: nivel, indiceSubnivel: i, rango: r };
    }
    return { nivel: nivel, indiceSubnivel: -1, rango: null };
  }

  function aprueba(nota) { return redondear(nota, 1) >= ESCALA.aprobatoria; }

  /**
   * Promedio ponderado con renormalización sobre los elementos que tienen nota.
   * Se usa en la rúbrica de cada instrumento y en la selección de actividades cognitivas.
   * @param {Array<{peso:number, nota:(number|null)}>} elementos
   * @returns {{nota:(number|null), exacta:(number|null), completo:boolean, pesoValorado:number}}
   */
  function promedioPonderado(elementos) {
    var sumaPesos = 0, acumulado = 0, valorados = 0;
    elementos.forEach(function (e) {
      if (esNumero(e.nota)) {
        validarNota(e.nota);
        sumaPesos += e.peso;
        acumulado += e.peso * e.nota;
        valorados++;
      }
    });
    if (sumaPesos === 0) return { nota: null, exacta: null, completo: false, pesoValorado: 0 };
    var exacta = acumulado / sumaPesos;
    return { nota: redondear(exacta, 1), exacta: exacta, completo: valorados === elementos.length, pesoValorado: sumaPesos };
  }

  /**
   * Nota de un instrumento a partir de su rúbrica analítica.
   * @param {Array<{peso:number, nota:(number|null)}>} criterios pesos en porcentaje o fracción
   */
  function notaInstrumento(criterios) { return promedioPonderado(criterios); }

  /**
   * Dominio cognitivo con selección de actividades por rotación.
   * Solo entran las actividades seleccionadas que ya tienen nota; los pesos base
   * se reponderan proporcionalmente para conservar su jerarquía.
   * @param {Array<{codigo:string, pesoBase:number, seleccionada:boolean, nota:(number|null)}>} actividades
   */
  function notaCognitiva(actividades) {
    var incluidas = actividades.filter(function (a) { return a.seleccionada !== false; });
    var r = promedioPonderado(incluidas.map(function (a) { return { peso: a.pesoBase, nota: a.nota }; }));
    var suma = r.pesoValorado;
    r.pesosEfectivos = incluidas.map(function (a) {
      return { codigo: a.codigo, peso: esNumero(a.nota) && suma > 0 ? a.pesoBase / suma : 0 };
    });
    return r;
  }

  /**
   * Dominio actitudinal multiagente. Docente (DOC), par (PAR) y autoevaluación (EST)
   * pesan lo mismo; si falta un agente se promedian los disponibles.
   * @param {{DOC?:number, PAR?:number, EST?:number}} agentes
   */
  function notaActitudinal(agentes) {
    return promedioPonderado(AGENTES_ACTITUDINAL.map(function (k) {
      return { peso: 1, nota: esNumero(agentes[k]) ? agentes[k] : null };
    }));
  }

  /**
   * Nota de dominios: 10 % actitudinal, 40 % procedimental, 50 % cognitivo.
   * @param {{actitudinal:number, procedimental:number, cognitivo:number}} d
   */
  function notaDominios(d, pesos) {
    var p = pesos || PESOS_DOMINIOS;
    [d.actitudinal, d.procedimental, d.cognitivo].forEach(validarNota);
    var exacta = p.actitudinal * d.actitudinal + p.procedimental * d.procedimental + p.cognitivo * d.cognitivo;
    return { nota: redondear(exacta, 1), exacta: exacta };
  }

  /**
   * Nota de la rotación: 75 % dominios y 25 % examen final de rotación.
   * En prácticas sin examen (Actividad Física y Deporte) la nota es la de dominios.
   * @param {{dominios:number, examen:(number|null)}} r
   * @param {{aplicaExamen?:boolean}} [opciones]
   */
  function notaRotacion(r, opciones) {
    var aplicaExamen = !opciones || opciones.aplicaExamen !== false;
    validarNota(r.dominios);
    if (!aplicaExamen) return { nota: redondear(r.dominios, 1), exacta: r.dominios };
    if (!esNumero(r.examen)) return { nota: null, exacta: null, pendiente: 'examen' };
    validarNota(r.examen);
    var exacta = PESOS_ROTACION.dominios * r.dominios + PESOS_ROTACION.examen * r.examen;
    return { nota: redondear(exacta, 1), exacta: exacta };
  }

  /**
   * Nota de la práctica formativa como promedio de sus rotaciones.
   * PENDIENTE DE VALIDACIÓN: confirmar si todas las rotaciones pesan igual.
   * @param {Array<number|null>} notasRotaciones
   */
  function notaPractica(notasRotaciones) {
    return promedioPonderado(notasRotaciones.map(function (n) { return { peso: 1, nota: n }; }));
  }

  /**
   * Logro de un RA como promedio ponderado de las notas de los instrumentos
   * alineados en la matriz de alineación (pesos definidos por el comité curricular).
   * PENDIENTE DE VALIDACIÓN: pesos de la matriz de alineación.
   * @param {Array<{peso:number, nota:(number|null)}>} evidencias
   */
  function logroRA(evidencias) { return promedioPonderado(evidencias); }

  /** Porcentaje de estudiantes por nivel para un conjunto de notas. */
  function distribucionPorNivel(notas) {
    var conteo = { insuficiente: 0, basico: 0, competente: 0, destacado: 0 };
    var validas = notas.filter(esNumero);
    validas.forEach(function (n) { conteo[nivelDesempeno(n).id]++; });
    var total = validas.length || 1;
    return NIVELES.map(function (nv) {
      return { id: nv.id, nombre: nv.nombre, n: conteo[nv.id], porcentaje: Math.round(conteo[nv.id] / total * 100) };
    });
  }

  return {
    ESCALA: ESCALA,
    NIVELES: NIVELES,
    PESOS_DOMINIOS: PESOS_DOMINIOS,
    PESOS_ROTACION: PESOS_ROTACION,
    AGENTES_ACTITUDINAL: AGENTES_ACTITUDINAL,
    redondear: redondear,
    nivelDesempeno: nivelDesempeno,
    subnivel: subnivel,
    aprueba: aprueba,
    promedioPonderado: promedioPonderado,
    notaInstrumento: notaInstrumento,
    notaCognitiva: notaCognitiva,
    notaActitudinal: notaActitudinal,
    notaDominios: notaDominios,
    notaRotacion: notaRotacion,
    notaPractica: notaPractica,
    logroRA: logroRA,
    distribucionPorNivel: distribucionPorNivel
  };
});
