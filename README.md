# Motor RA Fisioterapia

Panel estático para visualizar el flujo del Motor de Resultados de Aprendizaje de Fisioterapia durante el piloto 2026-2. Está diseñado para publicarse directamente en GitHub Pages.

## Publicación en GitHub Pages

1. Cree un repositorio y copie el contenido de esta carpeta en la raíz.
2. En GitHub, abra **Settings → Pages**.
3. Seleccione **Deploy from a branch**, la rama `main` y la carpeta `/(root)`.
4. Guarde. GitHub mostrará la URL de publicación.

No requiere instalación, compilación, servidor, base de datos ni secretos. La información de la demostración se guarda únicamente en `localStorage` del navegador.

## Uso

- Pulse **Cargar ejemplo** para explorar el flujo completo.
- En **Cargas**, importe uno o varios CSV con estas columnas: `asignatura`, `estudiante`, `actividad`, `codigo_actividad`, `instrumento`, `nota`. Para comparar periodos, agregue la columna opcional `periodo` (por ejemplo, `2025-2`). Si el archivo no la trae, el campo de periodo de la página se asigna a sus filas. El semestre se deriva de la matriz por asignatura; también se acepta una columna opcional `semestre`.
- Use **Agregar a los datos cargados** para combinar varios periodos. En **Resultados RA**, la primera gráfica sigue RA1 y RA2 a través de los cortes semestre-periodo; la segunda compara semestres del periodo seleccionado. La tabla muestra valores, número de notas y suma de pesos para auditar cada punto.
- En **Actividades y alineación**, el sitio aplica automáticamente los RA de la matriz para la pareja asignatura + código. Puede leer el código en `codigo_actividad`, `actividad` o `instrumento`. Si el nombre de actividad o instrumento contiene “examen”, lo asigna automáticamente a todos los RA en los que aporta la asignatura, aun sin código.
- En **Resultados RA**, cada nota válida se pondera según el aporte de la asignatura al RA: Introduce = 0,33; Refuerza = 0,66; Domina = 1,00. El porcentaje mostrado es `100 × [Σ(nota × aporte) / Σ(aporte)] / 5`, por RA, semestre y periodo. “Sin aporte” y filas inválidas quedan fuera del cálculo. Es desempeño ponderado sobre la escala máxima, sin un factor adicional de hito curricular.

La matriz curricular y la relación de actividades realizables para las 47 asignaturas están incorporadas en `assets/activity-mappings.js`. `assets/mappings.js` expone esa misma matriz al sitio. Las actividades sin código reconocible y que no sean exámenes se muestran como pendientes de identificación; el sitio no solicita escoger RA.

## Límites de esta versión web

GitHub Pages entrega archivos estáticos. Por ello esta versión no reemplaza el backend PostgreSQL/Prisma del proyecto maestro, la importación nativa de Excel ni el repositorio institucional de auditoría. La interfaz guarda datos solo en el navegador.

Antes de usarla como sistema institucional, conecte los flujos de carga, historial y cálculo oficial a un backend autenticado.
