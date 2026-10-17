# Heavy

App privada para registrar entrenos de gimnasio, carreras y rutas de senderismo, pensada para dos personas (mi hermano y yo). Inspirada en Hevy.

Es una **PWA**: una web que se instala en Android desde Chrome y funciona como una app, también sin conexión.

- App: https://guilleeca.github.io/heavy/
- Instalar en Android: abrir la URL en Chrome → menú ⋮ → **Instalar app**.

## Stack

- [Vite](https://vite.dev) + [React](https://react.dev) + TypeScript
- [React Router](https://reactrouter.com) (rutas con `#`, compatibles con GitHub Pages)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app) para instalarla y usarla sin conexión
- [Supabase](https://supabase.com) (PostgreSQL) para cuentas, rutinas y entrenos
- Ejercicios y animaciones de [ExerciseDB](https://exercisedb.dev) (API gratuita), con nombres traducidos al español
- Publicación automática en GitHub Pages con GitHub Actions (`.github/workflows/deploy.yml`)

## Desarrollo

```bash
npm install      # instalar dependencias
npm run dev      # app en http://localhost:5173/heavy/
npm run build    # compilar a dist/
npm run lint     # revisar el código
```

Cada push a `main` compila y publica la app.

## Estructura

```
src/
  main.tsx            arranque y rutas
  styles/theme.css    colores, tipografía y estilos base
  components/         piezas comunes (barra de pestañas, iconos)
  pages/              una pantalla por archivo: Inicio, Entrenamiento, Perfil
public/               iconos de la app
supabase/migrations/  scripts SQL de la base de datos (ejecutar en orden)
src/data/exercises.json  biblioteca de ejercicios (generada desde ExerciseDB)
```

## Hoja de ruta

1. ~~Repositorio y publicación en GitHub Pages~~
2. ~~Esqueleto: tema, navegación e instalación en el móvil~~
3. ~~Supabase: cuentas para los dos y base de datos~~
4. ~~Ejercicios y rutinas (carpetas, notas por ejercicio)~~
5. ~~Entreno en directo (y ver el del otro en tiempo real)~~
6. ~~Rutas y carreras: importar GPX, mapa, altitud y parciales~~
7. ~~Inicio: canal con me gusta y comentarios~~
8. ~~Perfil: estadísticas, calendario, medidas y récords~~
9. ~~Importar el historial de Hevy (CSV)~~
10. ~~Strava (enlaces y GPX, sin API)~~
11. ~~App de Android (Capacitor)~~
12. Enviar el entreno al Excel del entrenador (pendiente)

## App de Android

`android/` es un proyecto de Capacitor que carga la web publicada (`capacitor.config.ts` → `server.url`),
así que cada `git push` actualiza también la app. Lo nativo está en `src/native/`: login de Google en el
navegador del sistema, botón Atrás, "Compartir con Heavy", notificación del entreno y aviso de descanso
programado, avisos push por Firebase y GPS con la pantalla apagada al seguir rutas.

- El APK lo compila `.github/workflows/android.yml` y lo publica en Releases → `android` → `heavy.apk`
  (en el móvil: Perfil → ⚙ → Descargar la app de Android).
- Solo hay que instalar un APK nuevo cuando cambia algo de `android/`, `capacitor.config.ts` o los plugins.
- Secretos de GitHub: `HEAVY_KEYSTORE_PASSWORD` y `GOOGLE_SERVICES_JSON`. Secreto de Supabase: `FCM_SERVICE_ACCOUNT`.
- La firma (`android/heavy-release.p12`) la crea el workflow la primera vez. No borrarla: sin ella Android
  no deja actualizar la app instalada.

### Pendiente: Excel del entrenador

Al terminar un entreno, un botón que pase las series al Excel compartido del entrenador.
Antes de empezar hay que preguntar:

- ¿Dónde está el Excel compartido: Google Drive (Sheets) u OneDrive (Excel online)?
- Una copia o acceso al archivo para ver cómo está organizado: una pestaña por semana o por día,
  si el entrenador escribe el plan (series y reps objetivo) y se rellena lo hecho, o se escribe todo de cero,
  y cómo nombra los ejercicios (para emparejarlos con los de Heavy).
- Cómo le gustaría que funcionara: cuándo se envía, qué datos y dónde se escriben.
