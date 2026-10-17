package es.heavy.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Puente con la web: notificación del entreno en curso (ver WorkoutNotifier) */
@CapacitorPlugin(name = "HeavyWorkout")
public class WorkoutPlugin extends Plugin {

    private static WorkoutPlugin instance;

    @Override
    public void load() {
        instance = this;
        WorkoutNotifier.channels(getContext());
    }

    /** Avisa a la web de un botón pulsado; false si la app no está viva */
    static boolean emit(String action) {
        WorkoutPlugin p = instance;
        if (p == null || p.getBridge() == null) return false;
        JSObject data = new JSObject();
        data.put("action", action);
        p.notifyListeners("action", data, true);
        return true;
    }

    @Override
    protected void handleOnResume() {
        WorkoutNotifier.foreground = true;
        WorkoutNotifier.clearAlert(getContext());
    }

    @Override
    protected void handleOnPause() {
        WorkoutNotifier.foreground = false;
    }

    @PluginMethod
    public void show(PluginCall call) {
        WorkoutNotifier.save(
            getContext(),
            call.getString("title", "Entreno"),
            call.getString("body", ""),
            call.getLong("restEndsAt", 0L),
            call.getBoolean("hasNext", false)
        );
        call.resolve();
    }

    @PluginMethod
    public void close(PluginCall call) {
        WorkoutNotifier.close(getContext());
        call.resolve();
    }

    @PluginMethod
    public void beep(PluginCall call) {
        WorkoutNotifier.beep(getContext());
        WorkoutNotifier.vibrate(getContext());
        call.resolve();
    }
}
