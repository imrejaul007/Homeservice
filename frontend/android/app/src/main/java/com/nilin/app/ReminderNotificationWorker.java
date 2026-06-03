package com.nilin.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * WorkManager Worker for displaying scheduled reminder notifications
 */
public class ReminderNotificationWorker extends Worker {

    private static final String TAG = "NILIN/ReminderWorker";

    // Atomic counter for unique notification IDs (prevents collision)
    private static final AtomicInteger sNotificationIdCounter = new AtomicInteger(1000);
    private static final String PREFS_NAME = "nilin_notification_ids";
    private static final String KEY_LAST_REMINDER_ID = "last_reminder_id";

    public ReminderNotificationWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        String title = getInputData().getString("title");
        String body = getInputData().getString("body");
        String bookingId = getInputData().getString("bookingId");
        String url = getInputData().getString("url");

        Log.d(TAG, "Executing reminder notification: " + title);

        try {
            // Use defaults
            if (title == null || title.isEmpty()) {
                title = "Booking Reminder";
            }
            if (body == null || body.isEmpty()) {
                body = "You have an upcoming booking";
            }

            // Build notification
            NotificationCompat.Builder builder = new NotificationCompat.Builder(
                getApplicationContext(),
                MainActivity.CHANNEL_REMINDERS
            )
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setColor(0xFFE8B4A8) // NILIN brand color
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body));

            // Create intent
            Intent intent = new Intent(getApplicationContext(), MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            if (bookingId != null) {
                intent.setAction("nilin://open/booking/" + bookingId);
            } else if (url != null) {
                intent.setAction(url);
            } else {
                intent.setAction("nilin://open/home");
            }

            PendingIntent pendingIntent = PendingIntent.getActivity(
                getApplicationContext(),
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            builder.setContentIntent(pendingIntent);

            // Show notification with unique ID
            NotificationManager notificationManager =
                (NotificationManager) getApplicationContext().getSystemService(Context.NOTIFICATION_SERVICE);

            if (notificationManager != null) {
                int notificationId = getUniqueNotificationId(bookingId);
                notificationManager.notify(notificationId, builder.build());
                Log.d(TAG, "Reminder notification displayed (ID: " + notificationId + ")");
            }

            return Result.success();

        } catch (Exception e) {
            Log.e(TAG, "Failed to display reminder notification", e);
            return Result.failure();
        }
    }

    /**
     * Get unique notification ID from persistent storage
     * Ensures uniqueness across worker instances
     */
    private int getUniqueNotificationId(String bookingId) {
        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String key = bookingId != null ? "reminder_" + bookingId : "reminder_default";
        int currentId = prefs.getInt(key, 1000);
        int newId = currentId + 1;

        // Ensure we don't exceed integer max value
        if (newId > Integer.MAX_VALUE - 1000) {
            newId = 1000;
        }

        prefs.edit().putInt(key, newId).apply();
        return newId;
    }
}
