package com.nilin.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.concurrent.TimeUnit;

/**
 * NILIN Sync Worker
 *
 * WorkManager worker that handles background synchronization of offline actions.
 * Triggered by SyncScheduler when network is available.
 */
public class SyncWorker extends Worker {

    private static final String TAG = "NILIN/SyncWorker";
    private static final String PREFS_NAME = "nilin_sync_state";
    private static final String KEY_LAST_SYNC = "last_sync_time";
    private static final String KEY_PENDING_COUNT = "pending_action_count";

    // FIX a) Sync Verification Missing - Acknowledgment timeout
    private static final String KEY_SYNC_ACKNOWLEDGED = "sync_acknowledged";
    private static final String KEY_SYNC_ACK_TIMESTAMP = "sync_ack_timestamp";
    private static final long SYNC_ACK_TIMEOUT_MS = 30 * 1000; // 30 seconds to acknowledge

    public SyncWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.d(TAG, "Starting sync work");

        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        try {
            // Get pending action count from storage
            int pendingCount = getPendingActionCount(context);
            Log.d(TAG, "Pending actions: " + pendingCount);

            // FIX a) Sync Verification Missing - Mark sync as started with timeout
            long syncId = System.currentTimeMillis();
            markSyncStarted(context, syncId);

            // Trigger React-side sync via broadcast
            triggerOfflineSync(context);

            // FIX a) Sync Verification Missing - Wait for acknowledgment
            boolean acknowledged = waitForAcknowledgment(context, syncId);

            if (acknowledged) {
                // Update last sync time
                prefs.edit()
                    .putLong(KEY_LAST_SYNC, System.currentTimeMillis())
                    .putInt(KEY_PENDING_COUNT, pendingCount)
                    .apply();

                Log.d(TAG, "Sync work completed successfully with acknowledgment");
                return Result.success();
            } else {
                // Sync was triggered but not acknowledged - mark for retry
                Log.w(TAG, "Sync triggered but not acknowledged within timeout");

                // Still return success since we did trigger sync
                // The React layer will retry on next opportunity
                prefs.edit()
                    .putLong(KEY_LAST_SYNC, System.currentTimeMillis())
                    .putInt(KEY_PENDING_COUNT, pendingCount)
                    .putBoolean("sync_unacknowledged", true)
                    .apply();

                return Result.success();
            }

        } catch (Exception e) {
            Log.e(TAG, "Sync work failed", e);

            // Retry on failure (WorkManager handles backoff)
            if (getRunAttemptCount() < 3) {
                Log.d(TAG, "Will retry sync work (attempt " + (getRunAttemptCount() + 1) + ")");
                return Result.retry();
            } else {
                Log.e(TAG, "Max retry attempts reached, giving up");
                return Result.failure();
            }
        }
    }

    /**
     * FIX a) Sync Verification Missing - Mark sync as started
     */
    private void markSyncStarted(Context context, long syncId) {
        SharedPreferences syncPrefs =
            context.getSharedPreferences("nilin_sync_trigger", Context.MODE_PRIVATE);
        syncPrefs.edit()
            .putBoolean(KEY_SYNC_ACKNOWLEDGED, false)
            .putLong(KEY_SYNC_ACK_TIMESTAMP, syncId)
            .putLong("current_sync_id", syncId)
            .apply();
        Log.d(TAG, "Sync marked as started, id: " + syncId);
    }

    /**
     * FIX a) Sync Verification Missing - Wait for React to acknowledge sync completion
     */
    private boolean waitForAcknowledgment(Context context, long syncId) {
        SharedPreferences syncPrefs =
            context.getSharedPreferences("nilin_sync_trigger", Context.MODE_PRIVATE);

        long startTime = System.currentTimeMillis();

        while (System.currentTimeMillis() - startTime < SYNC_ACK_TIMEOUT_MS) {
            // Check if sync was acknowledged
            long currentSyncId = syncPrefs.getLong("current_sync_id", 0);
            boolean acknowledged = syncPrefs.getBoolean(KEY_SYNC_ACKNOWLEDGED, false);

            if (acknowledged && currentSyncId == syncId) {
                Log.d(TAG, "Sync acknowledged for id: " + syncId);
                // Clear the acknowledged state for next sync
                syncPrefs.edit()
                    .putBoolean(KEY_SYNC_ACKNOWLEDGED, false)
                    .apply();
                return true;
            }

            // Also check if pending count dropped to 0 (all synced)
            SharedPreferences offlinePrefs =
                context.getSharedPreferences("nilin_offline_state", Context.MODE_PRIVATE);
            int pendingCount = offlinePrefs.getInt("pending_count", -1);
            if (pendingCount == 0) {
                Log.d(TAG, "All pending actions synced (count is 0)");
                return true;
            }

            // Wait a bit before checking again
            try {
                Thread.sleep(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        return false;
    }

    /**
     * Get count of pending offline actions from storage
     */
    private int getPendingActionCount(Context context) {
        try {
            SharedPreferences offlinePrefs =
                context.getSharedPreferences("nilin_offline_state", Context.MODE_PRIVATE);
            return offlinePrefs.getInt("pending_count", 0);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get pending count", e);
            return 0;
        }
    }

    /**
     * Trigger offline sync in React layer
     */
    private void triggerOfflineSync(Context context) {
        // Send broadcast to trigger sync
        Intent intent = new Intent("com.nilin.app.ACTION_TRIGGER_SYNC");
        intent.setPackage(context.getPackageName());
        context.sendBroadcast(intent);

        // Also update sync state for React to read
        SharedPreferences syncPrefs =
            context.getSharedPreferences("nilin_sync_trigger", Context.MODE_PRIVATE);
        syncPrefs.edit()
            .putBoolean("sync_requested", true)
            .putLong("sync_requested_at", System.currentTimeMillis())
            .apply();

        Log.d(TAG, "Sync trigger sent to React layer");
    }

    @Override
    public void onStopped() {
        super.onStopped();
        Log.d(TAG, "Sync work stopped");
    }
}
