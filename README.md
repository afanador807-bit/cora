# CORA · Fisioterapia

**CORA** significa **Calificación Objetiva de Resultados de Aprendizaje**. Este panel estático permite consolidar y visualizar los Resultados de Aprendizaje de Fisioterapia, y puede publicarse directamente en GitHub Pages.

La interfaz usa el logotipo proporcionado para CORA y toma como referencia la paleta y tipografía institucional de la Universidad del Cauca. La navegación tiene un azul claro y desaturado para mantener el contraste con el contenido.

## Publicación en GitHub Pages

1. Extraiga el archivo ZIP y cargue en la raíz del repositorio `index.html`, `README.md` y la carpeta completa `assets`. Si ya hay una versión, reemplace esos archivos y confirme los cambios. Incluya `.nojekyll` si su flujo de carga permite archivos ocultos.
2. En GitHub, abra **Settings → Pages**.
3. Seleccione **Deploy from a branch**, la rama `main` y la carpeta `/(root)`.
4. Guarde. GitHub mostrará la URL de publicación.

No requiere instalación, compilación, servidor, base de datos ni secretos. La información de la demostración se guarda únicamente en `localStorage` del navegador.

## Uso

- **Panel del programa** consolida los registros cargados; pulse **Cargar ejemplo** si quiere probar el flujo con datos ilustrativos.
- En **Panel del programa**, revise los registros importados, su estado y la media de logro ponderado de RA1 y RA2 por cortes disponibles.
- En **Cargas**, seleccione el periodo al que pertenecen las notas antes de importar un CSV. Puede elegir periodos existentes o escribir uno propio. Esa selección se aplica a todas las filas agregadas en esa carga.
- La página identifica el semestre a partir del nombre de la asignatura usando la matriz de currículo. Reconoce los nombres canónicos y variantes frecuentes del nombre de las asignaturas de Evaluación y Diagnóstico.
- Use **Agregar a los datos cargados** para combinar varios periodos. En **Resultados RA**, ambos gráficos usan barras agrupadas y tienen selectores independientes para mostrar RA1, RA2 o ambos. Pase el cursor sobre una barra para ver su valor exacto en escala de 0 a 5. El primero permite elegir periodo y semestres; el segundo compara los semestres del periodo que elija en su propio filtro. La tabla muestra valores, número de notas y suma de pesos para auditar cada punto.
- En **Actividades y alineación**, el sitio aplica automáticamente los RA de la matriz para la pareja asignatura + código. Puede leer el código en `codigo_actividad`, `actividad` o `instrumento`. Si el nombre de actividad o instrumento contiene “examen”, lo asigna automáticamente a todos los RA en los que aporta la asignatura, aun sin código.
- En **Interconexión curricular**, explore la red neuronal de asignaturas, RA, competencias y perfil de egreso. Elija una asignatura o pulse cualquier nodo para expandir la red; el control de alcance permite seguir conexiones de uno a cuatro grados. Arrastre el lienzo y use los controles de zoom. El modo **Orden cronológico por semestre** distribuye las asignaturas de izquierda a derecha, y la ficha lateral lista sus relaciones de semestre menor a mayor. En móvil, la ficha aparece como una hoja inferior y el lienzo conserva sus controles de exploración.
- Descargue **tabla CSV** para análisis posterior e **informe HTML** con metodología, resultados y distribución curricular de créditos.
- En **Resultados RA**, la medida **Aporte ponderado** conserva la fórmula `nota × factor`: Introduce = 0,33, Refuerza = 0,66 y Domina = 1,00; una nota de 4,0 aporta 1,32, 2,64 o 4,00, respectivamente.
- **Aporte ponderado por créditos** promedia primero las evidencias por estudiante y asignatura, luego promedia la asignatura y le da peso según sus créditos. **Progresión comparable por créditos** divide la suma de esos aportes ponderados por la suma de créditos × factor de aporte; así se expresa el desempeño en escala 0–5 sin reducirlo solo porque un curso Introduce.
- Cada gráfico permite elegir entre las tres medidas y mostrar RA1, RA2 o ambos. La tabla presenta las tres medidas por periodo, semestre y RA. No se calcula una línea acumulada.
- El panel **Créditos curriculares por nivel de aporte** resume créditos por RA y semestre en Introduce, Refuerza y Domina, según la matriz cargada.
- En **Cargas**, el panel **Revisión de calidad del archivo** distingue errores de datos, asignaturas no reconocidas, códigos faltantes, códigos no habilitados y asignaturas sin aporte. Las filas sin mapear se excluyen de los resultados y muestran una acción sugerida.
- Los registros con campos incompletos, notas no numéricas o notas fuera del rango 0–5 se excluyen sin bloquear el cálculo de las demás filas. La página informa cuántos registros válidos se usaron y cuántos se omitieron.
- En **Trayectoria del estudiante**, elija una persona y, si lo desea, un periodo. La vista toma los registros válidos mapeados del navegador y muestra el logro por periodo, semestre y RA.

La matriz curricular, los semestres y la relación de actividades realizables para las 47 asignaturas están incorporadas en `assets/activity-mappings.js`. Las relaciones entre asignaturas, competencias y perfil de egreso se cargan desde `assets/curricular-network.js`; la visualización interactiva se implementa en `assets/network-explorer.js`. `assets/mappings.js` expone esa misma matriz al sitio. Las actividades sin código reconocible y que no sean exámenes se muestran como pendientes de identificación; el sitio no solicita escoger RA.

En ambos gráficos se puede seleccionar la medida de logro, RA1, RA2 o ambos. La trayectoria por semestre permite marcar las cohortes curriculares disponibles en el periodo elegido; **Seleccionar todos** vuelve a incluir todos los semestres. Los filtros de RA, periodo y medida son independientes entre los dos gráficos.

Si la página publicada no refleja los cambios, confirme que se reemplazaron `index.html` y todos los archivos dentro de `assets`, espere a que GitHub Pages termine la publicación y recargue el sitio sin caché (`⌘ + Shift + R` en Mac). Los recursos incluyen una versión en sus rutas para que el navegador solicite los estilos y scripts actualizados.

## Límites de esta versión web

GitHub Pages entrega archivos estáticos. Por ello esta versión no reemplaza el backend PostgreSQL/Prisma del proyecto maestro, la importación nativa de Excel ni el repositorio institucional de auditoría. La interfaz guarda datos solo en el navegador.

Antes de usarla como sistema institucional, conecte los flujos de carga, historial y cálculo oficial a un backend autenticado.
