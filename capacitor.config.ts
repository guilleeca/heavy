import type { CapacitorConfig } from '@capacitor/cli'

// App de Android de Heavy. Carga la web publicada en GitHub Pages: cada `git push`
// actualiza también la app, sin reinstalar. Solo hay que instalar un APK nuevo
// cuando cambia algo nativo (esta configuración, los plugins o android/).
const config: CapacitorConfig = {
  appId: 'es.heavy.app',
  appName: 'Heavy',
  webDir: 'dist',
  backgroundColor: '#000000',
  server: {
    url: 'https://guilleeca.github.io/heavy/',
    androidScheme: 'https',
  },
  android: {
    // Evita que el GPS en segundo plano se pare a los 5 minutos (background-geolocation)
    useLegacyBridge: true,
    backgroundColor: '#000000',
  },
  plugins: {
    // Pantalla de borde a borde: la web ya respeta env(safe-area-inset-*)
    SystemBars: {
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_heavy',
      iconColor: '#1c8cff',
    },
    PushNotifications: {
      presentationOptions: ['alert', 'sound'],
    },
  },
}

export default config
