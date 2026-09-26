# CORA · Fisioterapia

Panel estático para consolidar y visualizar los Resultados de Aprendizaje de Fisioterapia. Está diseñado para publicarse directamente en GitHub Pages.

La interfaz toma como referencia la paleta azul y roja, la tipografía de carácter editorial y la organización orientativa de la señalética institucional descritas en el [Manual de Identidad Visual de la Universidad del Cauca](https://www.unicauca.edu.co/wp-content/uploads/2024/08/Manual-de-Identidad-Visual_Unicauca_V2024-1.pdf). El sitio usa el nombre CORA y no reproduce el logosímbolo oficial.

## Publicación en GitHub Pages

1. Cree un repositorio y copie el contenido de esta carpeta en la raíz.
2. En GitHub, abra **Settings → Pages**.
3. Seleccione **Deploy from a branch**, la rama `main` y la carpeta `/(root)`.
4. Guarde. GitHub mostrará la URL de publicación.

No requiere instalación, compilación, servidor, base de datos ni secretos. La información de la demostración se guarda únicamente en `localStorage` del navegador.

## Uso

- Pulse **Cargar ejemplo** para explorar el flujo completo.
- En **Cargas**, seleccione el periodo al que pertenecen las notas antes de importar un CSV. Puede elegir periodos existentes o escribir uno propio. Esa selección se aplica a todas las filas agregadas en esa carga.
- La página identifica el semestre a partir del nombre de la asignatura usando la matriz de currículo. Reconoce los nombres canónicos y variantes frecuentes del nombre de las asignaturas de Evaluación y Diagnóstico.
- Use **Agregar a los datos cargados** para combinar varios periodos. En **Resultados RA**, la primera gráfica sigue RA1 y RA2 a través de los cortes semestre-periodo; la segunda compara semestres del periodo seleccionado. La tabla muestra valores, número de notas y suma de pesos para auditar cada punto.
- En **Actividades y alineación**, el sitio aplica automáticamente los RA de la matriz para la pareja asignatura + código. Puede leer el código en `codigo_actividad`, `actividad` o `instrumento`. Si el nombre de actividad o instrumento contiene “examen”, lo asigna automáticamente a todos los RA en los que aporta la asignatura, aun sin código.
- En **Resultados RA**, el factor multiplica el porcentaje de logro de cada nota: `100 × (nota / 5) × aporte`, con Introduce = 0,33, Refuerza = 0,66 y Domina = 1,00. El resultado por RA, semestre y periodo es el promedio de los aportes ajustados. Así, una nota de 5,0 aporta 33 %, 66 % o 100 %, respectivamente. “Sin aporte” y filas inválidas quedan fuera del cálculo.
- Los registros con campos incompletos, notas no numéricas o notas fuera del rango 0–5 se excluyen sin bloquear el cálculo de las demás filas. La página informa cuántos registros válidos se usaron y cuántos se omitieron.

La matriz curricular, los semestres y la relación de actividades realizables para las 47 asignaturas están incorporadas en `assets/activity-mappings.js`. `assets/mappings.js` expone esa misma matriz al sitio. Las actividades sin código reconocible y que no sean exámenes se muestran como pendientes de identificación; el sitio no solicita escoger RA.

El gráfico **Trayectoria de RA por semestre** permite elegir un periodo académico y marcar los semestres que se desean comparar. Sus casillas se actualizan según los datos válidos disponibles en el periodo elegido; las líneas muestran RA1 y RA2 para los semestres seleccionados. El botón **Seleccionar todos** vuelve a incluir todos los semestres disponibles. Este filtro es independiente del periodo del segundo gráfico.

## Límites de esta versión web

GitHub Pages entrega archivos estáticos. Por ello esta versión no reemplaza el backend PostgreSQL/Prisma del proyecto maestro, la importación nativa de Excel ni el repositorio institucional de auditoría. La interfaz guarda datos solo en el navegador.

Antes de usarla como sistema institucional, conecte los flujos de carga, historial y cálculo oficial a un backend autenticado.
