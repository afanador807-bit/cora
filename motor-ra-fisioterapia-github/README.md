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
- En **Cargas**, importe un CSV con estas columnas: `asignatura`, `estudiante`, `actividad`, `instrumento`, `nota`.
- En **Actividades y alineación**, registre y valide las decisiones por actividad e instrumento.
- En **Resultados RA**, vea por separado el cálculo institucional demostrativo y el cálculo basado en evidencias validadas.

## Límites de esta versión web

GitHub Pages entrega archivos estáticos. Por ello esta versión no reemplaza el backend PostgreSQL/Prisma del proyecto maestro, la importación nativa de Excel ni el repositorio institucional de auditoría. Es una interfaz demostrativa y publicable que conserva las reglas de operación: alineación explícita evidencia → RA, validación humana y separación entre métodos de cálculo.

Antes de usarla como sistema institucional, conecte los flujos de carga, historial y cálculo oficial a un backend autenticado.
