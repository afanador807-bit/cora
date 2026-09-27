# CORA · Fisioterapia

Panel estático para consolidar y visualizar los Resultados de Aprendizaje de Fisioterapia. Está diseñado para publicarse directamente en GitHub Pages.

La interfaz toma como referencia la paleta azul y roja, la tipografía de carácter editorial y la organización orientativa de la señalética institucional descritas en el [Manual de Identidad Visual de la Universidad del Cauca](https://www.unicauca.edu.co/wp-content/uploads/2024/08/Manual-de-Identidad-Visual_Unicauca_V2024-1.pdf). El sitio usa el nombre CORA y no reproduce el logosímbolo oficial.

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
- Use **Agregar a los datos cargados** para combinar varios periodos. En **Resultados RA**, la gráfica **Trayectoria de RA por semestre** permite elegir un periodo y los semestres que se desean comparar; muestra RA1 y RA2 para esos semestres. La segunda gráfica compara los semestres del periodo que se elija en su propio filtro. La tabla muestra valores, número de notas y suma de pesos para auditar cada punto.
- En **Actividades y alineación**, el sitio aplica automáticamente los RA de la matriz para la pareja asignatura + código. Puede leer el código en `codigo_actividad`, `actividad` o `instrumento`. Si el nombre de actividad o instrumento contiene “examen”, lo asigna automáticamente a todos los RA en los que aporta la asignatura, aun sin código.
- En **Resultados RA**, el factor multiplica el porcentaje de logro de cada nota: `100 × (nota / 5) × aporte`, con Introduce = 0,33, Refuerza = 0,66 y Domina = 1,00. El resultado por RA, semestre y periodo es el promedio de los aportes ajustados. Así, una nota de 5,0 aporta 33 %, 66 % o 100 %, respectivamente. “Sin aporte” y filas inválidas quedan fuera del cálculo.
- Los registros con campos incompletos, notas no numéricas o notas fuera del rango 0–5 se excluyen sin bloquear el cálculo de las demás filas. La página informa cuántos registros válidos se usaron y cuántos se omitieron.
- En **Trayectoria estudiante**, elija una persona y, si lo desea, un periodo. La vista toma los registros válidos mapeados del navegador y muestra el logro por periodo, semestre y RA.
- En **Evaluar sesión**, aplique la rúbrica P2 de tres criterios (35 %, 40 % y 25 %). La nota se calcula con la escala institucional de 0 a 5 y se registra como P2-SE. CORA usa la asignatura seleccionada para detectar semestre y RA con su matriz actual.
- En **Registro actitudinal**, escoja el agente (docente, par o autoevaluación) y valore los cuatro criterios ilustrativos del paquete recibido. La opción de nivel toma el valor superior del subnivel intermedio; la media resultante se registra con el código A y se procesa mediante la matriz CORA. Valide los criterios con la rúbrica vigente del programa antes de usarla para calificaciones oficiales.

La matriz curricular, los semestres y la relación de actividades realizables para las 47 asignaturas están incorporadas en `assets/activity-mappings.js`. `assets/mappings.js` expone esa misma matriz al sitio. Las actividades sin código reconocible y que no sean exámenes se muestran como pendientes de identificación; el sitio no solicita escoger RA. La lógica de niveles y rúbrica está en `assets/evaluacion-ra-calculo.js`; los criterios adaptados del instrumento P2 están en `assets/rubrica-p2.js`.

El paquete adjunto también contenía un modelo de cinco resultados de aprendizaje y consolidación por dominios y rotaciones clínicas. CORA conserva su matriz curricular vigente de dos RA y su ponderación de aportes Introduce/Refuerza/Domina; los datos de ejemplo de cinco RA no se mezclan con estos cálculos.

El gráfico **Trayectoria de RA por semestre** permite elegir un periodo académico y marcar los semestres que se desean comparar. Sus casillas se actualizan según los datos válidos disponibles en el periodo elegido; las líneas muestran RA1 y RA2 para los semestres seleccionados. El botón **Seleccionar todos** vuelve a incluir todos los semestres disponibles. Este filtro es independiente del periodo del segundo gráfico.

Si la página publicada no refleja los cambios, confirme que se reemplazaron `index.html` y todos los archivos dentro de `assets`, espere a que GitHub Pages termine la publicación y recargue el sitio sin caché (`⌘ + Shift + R` en Mac). Los recursos incluyen una versión en sus rutas para que el navegador solicite los estilos y scripts actualizados.

## Límites de esta versión web

GitHub Pages entrega archivos estáticos. Por ello esta versión no reemplaza el backend PostgreSQL/Prisma del proyecto maestro, la importación nativa de Excel ni el repositorio institucional de auditoría. La interfaz guarda datos solo en el navegador.

Antes de usarla como sistema institucional, conecte los flujos de carga, historial y cálculo oficial a un backend autenticado.
