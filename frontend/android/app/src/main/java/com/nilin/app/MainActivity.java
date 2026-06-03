package com.nilin.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Notification channel ID for reminders
    public static final String CHANNEL_REMINDERS = "nilin_reminders";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Create notification channel for Android O+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_REMINDERS, "Reminders", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Booking reminders");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }

        // Register crash handler
        Thread.setDefaultUncaughtExceptionHandler(new CrashHandler(this,
            Thread.getDefaultUncaughtExceptionHandler()));
    }
}
