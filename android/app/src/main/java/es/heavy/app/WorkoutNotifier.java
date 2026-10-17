package es.heavy.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;

/**
 * Notificación fija del entreno en curso (como la de Hevy).
 * - Durante el descanso: cuenta atrás en segundos (la pinta Android, sin depender de la app)
 *   y botones −15 s / +15 s, que se aplican aquí mismo aunque la app esté dormida.
 * - Al acabar el descanso (alarma exacta): pitido que baja un momento la música
 *   (como las indicaciones del GPS), vibración y un aviso que se quita solo a los 10 s.
 *   La notificación fija vuelve a "Completar serie".
 */
public class WorkoutNotifier {

    static final String CH_ONGOING = "heavy_workout";
    static final String CH_ALERT = "heavy_rest_alert";
    static final int ID_ONGOING = 1001;
    static final int ID_ALERT = 1002;
    static final String PREFS = "heavy_workout";

    static final String ACTION_MINUS = "es.heavy.app.REST_MINUS";
    static final String ACTION_PLUS = "es.heavy.app.REST_PLUS";
    static final String ACTION_COMPLETE = "es.heavy.app.COMPLETE";
    static final String ACTION_REST_DONE = "es.heavy.app.REST_DONE";

    /** ¿Está la app en pantalla? (lo actualiza el plugin) */
    static volatile boolean foreground = false;

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel ongoing = new NotificationChannel(CH_ONGOING, "Entreno en curso", NotificationManager.IMPORTANCE_LOW);
        ongoing.setShowBadge(false);
        ongoing.setSound(null, null);
        ongoing.enableVibration(false);
        nm.createNotificationChannel(ongoing);
        NotificationChannel alert = new NotificationChannel(CH_ALERT, "Fin del descanso", NotificationManager.IMPORTANCE_HIGH);
        // El sonido lo pone la app (baja la música mientras suena); aquí solo vibración
        alert.setSound(null, null);
        alert.enableVibration(true);
        alert.setVibrationPattern(new long[] { 0, 250, 120, 250 });
        nm.createNotificationChannel(alert);
    }

    /** Guarda el estado y pinta la notificación; programa (o quita) la alarma del descanso */
    static void save(Context c, String title, String body, long restEndsAt, boolean hasNext) {
        prefs(c).edit()
            .putString("title", title)
            .putString("body", body)
            .putLong("endsAt", restEndsAt)
            .putBoolean("hasNext", hasNext)
            .putBoolean("active", true)
            .apply();
        render(c);
        schedule(c, restEndsAt);
    }

    static PendingIntent action(Context c, String action, int code) {
        Intent i = new Intent(c, WorkoutActionReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        i.putExtra("heavyOpen", "#/entreno");
        return PendingIntent.getActivity(c, 10, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void render(Context c) {
        SharedPreferences p = prefs(c);
        if (!p.getBoolean("active", false)) return;
        channels(c);
        long endsAt = p.getLong("endsAt", 0);
        boolean resting = endsAt > System.currentTimeMillis();
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH_ONGOING)
            .setSmallIcon(R.drawable.ic_stat_heavy)
            .setColor(Color.parseColor("#1C8CFF"))
            .setContentText(p.getString("body", ""))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(p.getString("body", "")))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openApp(c));
        if (resting) {
            // Cuenta atrás "2:15, 2:14…" que Android actualiza solo
            b.setContentTitle("Descanso")
                .setWhen(endsAt)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .addAction(0, "−15 s", action(c, ACTION_MINUS, 1))
                .addAction(0, "+15 s", action(c, ACTION_PLUS, 2));
        } else {
            b.setContentTitle(p.getString("title", "Entreno")).setShowWhen(false);
            if (p.getBoolean("hasNext", false)) b.addAction(0, "✓ Completar serie", action(c, ACTION_COMPLETE, 3));
        }
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        try {
            nm.notify(ID_ONGOING, b.build());
        } catch (SecurityException e) {
            // Sin permiso de notificaciones
        }
    }

    static PendingIntent restDoneIntent(Context c, long endsAt) {
        Intent i = new Intent(c, WorkoutActionReceiver.class).setAction(ACTION_REST_DONE).putExtra("endsAt", endsAt);
        return PendingIntent.getBroadcast(c, 20, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void schedule(Context c, long endsAt) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        am.cancel(restDoneIntent(c, 0));
        if (endsAt <= System.currentTimeMillis()) return;
        PendingIntent pi = restDoneIntent(c, endsAt);
        if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pi);
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pi);
        }
    }

    /** Mueve el descanso ±segundos (desde la notificación, sin abrir la app) */
    static long shift(Context c, int seconds) {
        SharedPreferences p = prefs(c);
        long endsAt = p.getLong("endsAt", 0);
        long now = System.currentTimeMillis();
        if (endsAt <= now) return 0;
        long next = Math.max(now + 1000, endsAt + seconds * 1000L);
        p.edit().putLong("endsAt", next).apply();
        render(c);
        schedule(c, next);
        return next;
    }

    /** Fin del descanso: pitido, vibración, aviso de 10 s y la notificación vuelve a "Completar serie" */
    static void restDone(Context c, long endsAt) {
        SharedPreferences p = prefs(c);
        if (!p.getBoolean("active", false) || p.getLong("endsAt", 0) != endsAt) return;
        p.edit().putLong("endsAt", 0).apply();
        render(c);
        beep(c);
        vibrate(c);
        if (foreground) return;
        channels(c);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH_ALERT)
            .setSmallIcon(R.drawable.ic_stat_heavy)
            .setColor(Color.parseColor("#1C8CFF"))
            .setContentTitle("¡Descanso terminado!")
            .setContentText(p.getString("body", ""))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setTimeoutAfter(10_000)
            .setContentIntent(openApp(c));
        if (p.getBoolean("hasNext", false)) b.addAction(0, "✓ Completar serie", action(c, ACTION_COMPLETE, 4));
        try {
            ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(ID_ALERT, b.build());
        } catch (SecurityException e) {
            // Sin permiso de notificaciones
        }
    }

    static void close(Context c) {
        prefs(c).edit().clear().apply();
        schedule(c, 0);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(ID_ONGOING);
        nm.cancel(ID_ALERT);
    }

    static void clearAlert(Context c) {
        ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(ID_ALERT);
    }

    /** Pitido que baja un momento la música (Spotify…) en vez de sonar por debajo */
    static void beep(Context c) {
        try {
            AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            final AudioFocusRequest[] req = new AudioFocusRequest[1];
            if (Build.VERSION.SDK_INT >= 26) {
                req[0] = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attrs).build();
                am.requestAudioFocus(req[0]);
            }
            MediaPlayer mp = new MediaPlayer();
            mp.setAudioAttributes(attrs);
            mp.setDataSource(c, android.net.Uri.parse("android.resource://" + c.getPackageName() + "/" + R.raw.rest_done));
            mp.setOnCompletionListener((m) -> {
                m.release();
                if (Build.VERSION.SDK_INT >= 26 && req[0] != null) am.abandonAudioFocusRequest(req[0]);
            });
            mp.prepare();
            mp.start();
        } catch (Exception e) {
            // Sin sonido
        }
    }

    static void vibrate(Context c) {
        try {
            Vibrator v = (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null) return;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(new long[] { 0, 250, 120, 250 }, -1));
            else v.vibrate(new long[] { 0, 250, 120, 250 }, -1);
        } catch (Exception e) {
            // Sin vibración
        }
    }
}
