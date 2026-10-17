package es.heavy.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propio: notificación del entreno con cuenta atrás y aviso de descanso
        registerPlugin(WorkoutPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
