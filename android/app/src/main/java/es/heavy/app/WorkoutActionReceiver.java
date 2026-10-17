package es.heavy.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Botones de la notificación del entreno y alarma de fin de descanso */
public class WorkoutActionReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context c, Intent intent) {
        String a = intent.getAction();
        if (a == null) return;
        switch (a) {
            case WorkoutNotifier.ACTION_MINUS:
                WorkoutNotifier.shift(c, -15);
                WorkoutPlugin.emit("rest-minus");
                break;
            case WorkoutNotifier.ACTION_PLUS:
                WorkoutNotifier.shift(c, 15);
                WorkoutPlugin.emit("rest-plus");
                break;
            case WorkoutNotifier.ACTION_COMPLETE:
                WorkoutNotifier.clearAlert(c);
                // Si la app no está viva, se abre para poder marcar la serie
                if (!WorkoutPlugin.emit("complete")) {
                    Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    open.putExtra("heavyAction", "complete");
                    c.startActivity(open);
                }
                break;
            case WorkoutNotifier.ACTION_REST_DONE:
                WorkoutNotifier.restDone(c, intent.getLongExtra("endsAt", 0));
                WorkoutPlugin.emit("rest-done");
                break;
            default:
                break;
        }
    }
}
