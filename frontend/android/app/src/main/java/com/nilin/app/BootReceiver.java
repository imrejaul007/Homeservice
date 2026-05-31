package com.nilin.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            // App can be launched after boot if needed
            // Most Capacitor apps don't need this, but it's here for WorkManager scheduling
        }
    }
}
