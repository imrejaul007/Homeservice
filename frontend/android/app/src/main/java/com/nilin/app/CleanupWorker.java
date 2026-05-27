package com.nilin.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * NILIN Cleanup Worker
 *
 * WorkManager worker that periodically cleans up old data:
 * - Completed sync actions older than 24 hours
 * - Old crash reports
 * - Expired cache data
 */
public class CleanupWorker extends Worker {

    private static final String TAG = "NILIN/CleanupWorker";
    private static final String OFFLINE_ACTIONS_KEY = "nilin_offline_state";
    private static final String CRASH_STATE_KEY = "nilin_crash_state";
    private static final String SYNC_STATE_KEY = "nilin_sync_state";
    private static final String KEY_LAST_SYNC = "last_sync_time";
    private static final long CLEANUP_AGE_HOURS = 24;

    public CleanupWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.d(TAG, "Starting cleanup work");

        Context context = getApplicationContext();
        int totalCleaned = 0;

        try {
            // Clean up old offline actions
            totalCleaned += cleanupOldOfflineActions(context);

            // Clean up old crash reports
            cleanupOldCrashReports(context);

            // Clean up old sync triggers
            cleanupOldSyncTriggers(context);

            // Clean up old sync state entries
            cleanupOldSyncState(context);

            // Clean up temporary data
            cleanupTempData(context);

            Log.d(TAG, "Cleanup completed successfully. Total items cleaned: " + totalCleaned);
            return Result.success();

        } catch (Exception e) {
            Log.e(TAG, "Cleanup failed", e);
            return Result.failure();
        }
    }

    /**
     * FIX a) Cleanup Doesn't Clean - Actually implement the data deletion logic
     * Remove completed offline actions older than cleanup age
     */
    private int cleanupOldOfflineActions(Context context) {
        int cleanedCount = 0;
        try {
            SharedPreferences prefs = context.getSharedPreferences(OFFLINE_ACTIONS_KEY, Context.MODE_PRIVATE);
            String stored = prefs.getString("offline_actions", null);

            if (stored == null || stored.isEmpty()) {
                Log.d(TAG, "No offline actions to cleanup");
                return 0;
            }

            long cutoffTime = System.currentTimeMillis() - TimeUnit.HOURS.toMillis(CLEANUP_AGE_HOURS);
            List<String> keptActions = new ArrayList<>();
            List<String> cleanedActions = new ArrayList<>();

            try {
                JSONArray actions = new JSONArray(stored);
                for (int i = 0; i < actions.length(); i++) {
                    JSONObject action = actions.getJSONObject(i);

                    // Check if action is completed and old
                    boolean isCompleted = action.optBoolean("completed", false);
                    long completedAt = action.optLong("completedAt", 0);

                    if (isCompleted && completedAt > 0 && completedAt < cutoffTime) {
                        // This action is old and completed - clean it
                        cleanedActions.add(action.toString());
                        cleanedCount++;
                    } else {
                        // Keep this action
                        keptActions.add(action.toString());
                    }
                }

                // Save only the kept actions
                JSONArray keptArray = new JSONArray();
                for (String actionStr : keptActions) {
                    keptArray.put(new JSONObject(actionStr));
                }

                if (keptArray.length() > 0) {
                    prefs.edit().putString("offline_actions", keptArray.toString()).apply();
                } else {
                    // Remove the key entirely if no actions left
                    prefs.edit().remove("offline_actions").apply();
                }

                // Update pending count
                int newPendingCount = 0;
                for (String actionStr : keptActions) {
                    JSONObject action = new JSONObject(actionStr);
                    if (!action.optBoolean("completed", false)) {
                        newPendingCount++;
                    }
                }
                prefs.edit().putInt("pending_count", newPendingCount).apply();

                Log.d(TAG, "Cleaned " + cleanedCount + " old offline actions. Remaining: " + keptActions.size());

            } catch (Exception e) {
                Log.e(TAG, "Error parsing offline actions JSON", e);
                // If JSON is corrupted, clear it
                prefs.edit().remove("offline_actions").apply();
                cleanedCount++;
            }

        } catch (Exception e) {
            Log.e(TAG, "Failed to cleanup offline actions", e);
        }
        return cleanedCount;
    }

    /**
     * Reset old crash count after successful app usage
     */
    private void cleanupOldCrashReports(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(CRASH_STATE_KEY, Context.MODE_PRIVATE);

            // If no crash in last 24 hours and app is running fine, reset count
            long lastCrashTime = prefs.getLong("last_crash_time", 0);
            long cutoffTime = System.currentTimeMillis() - TimeUnit.HOURS.toMillis(CLEANUP_AGE_HOURS);

            if (lastCrashTime > 0 && lastCrashTime < cutoffTime) {
                // Crash was long ago, reset count to track new crashes
                prefs.edit()
                    .putInt("crash_count", 0)
                    .putInt("anr_count", 0)
                    .apply();
                Log.d(TAG, "Old crash count reset");
            }

            // Clean up old stack traces to save space
            String oldStackTrace = prefs.getString("last_crash_stack", null);
            if (oldStackTrace != null && oldStackTrace.length() > 1000) {
                // Keep only first 1000 chars of old stack trace
                prefs.edit()
                    .putString("last_crash_stack", oldStackTrace.substring(0, 1000))
                    .apply();
            }

        } catch (Exception e) {
            Log.e(TAG, "Failed to cleanup crash reports", e);
        }
    }

    /**
     * Clean up old sync trigger flags
     */
    private void cleanupOldSyncTriggers(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("nilin_sync_trigger", Context.MODE_PRIVATE);

            // Remove old sync triggers that were never picked up
            long requestedAt = prefs.getLong("sync_requested_at", 0);
            boolean wasRequested = prefs.getBoolean("sync_requested", false);

            if (wasRequested && requestedAt > 0) {
                long age = System.currentTimeMillis() - requestedAt;
                if (age > TimeUnit.HOURS.toMillis(2)) {
                    // Trigger was never picked up, clear it
                    prefs.edit()
                        .putBoolean("sync_requested", false)
                        .apply();
                    Log.d(TAG, "Cleared stale sync trigger");
                }
            }

        } catch (Exception e) {
            Log.e(TAG, "Failed to cleanup sync triggers", e);
        }
    }

    /**
     * FIX a) Cleanup Doesn't Clean - Clean up old sync state entries
     */
    private void cleanupOldSyncState(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(SYNC_STATE_KEY, Context.MODE_PRIVATE);

            // Clean up very old sync acknowledgments
            long lastSync = prefs.getLong(KEY_LAST_SYNC, 0);
            long cutoffTime = System.currentTimeMillis() - TimeUnit.HOURS.toMillis(CLEANUP_AGE_HOURS * 7); // 1 week

            if (lastSync > 0 && lastSync < cutoffTime) {
                // Last sync was over a week ago - clear old sync stats
                prefs.edit()
                    .remove("sync_stats")
                    .apply();
                Log.d(TAG, "Cleared old sync state");
            }

        } catch (Exception e) {
            Log.e(TAG, "Failed to cleanup sync state", e);
        }
    }

    /**
     * FIX a) Cleanup Doesn't Clean - Clean up temporary/cache data
     */
    private void cleanupTempData(Context context) {
        try {
            // Clean up any temporary sync data that's stale
            SharedPreferences prefs = context.getSharedPreferences("nilin_sync_trigger", Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();

            // Clean up unacknowledged sync state
            long syncAckTimestamp = prefs.getLong("sync_ack_timestamp", 0);
            if (syncAckTimestamp > 0) {
                long age = System.currentTimeMillis() - syncAckTimestamp;
                if (age > TimeUnit.HOURS.toMillis(1)) {
                    // Clear old acknowledgment state
                    editor.remove("sync_ack_timestamp");
                    editor.remove("current_sync_id");
                    Log.d(TAG, "Cleared stale sync acknowledgment state");
                }
            }

            // Clean up unacknowledged sync flag
            boolean syncUnacknowledged = prefs.getBoolean("sync_unacknowledged", false);
            if (syncUnacknowledged) {
                editor.remove("sync_unacknowledged");
                Log.d(TAG, "Cleared unacknowledged sync flag");
            }

            editor.apply();

        } catch (Exception e) {
            Log.e(TAG, "Failed to cleanup temp data", e);
        }
    }
}
