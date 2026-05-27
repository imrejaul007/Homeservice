package com.nilin.app;

import android.content.Context;
import android.util.Log;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkInfo;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

/**
 * NILIN Sync Scheduler
 *
 * Manages WorkManager-based background synchronization for offline actions.
 * Ensures reliable sync even when app is in background or killed.
 */
public class SyncScheduler {

    private static final String TAG = "NILIN/SyncScheduler";

    // Work names
    public static final String PERIODIC_SYNC_WORK = "nilin_periodic_sync";
    public static final String IMMEDIATE_SYNC_WORK = "nilin_immediate_sync";
    public static final String CLEANUP_WORK = "nilin_cleanup";

    // Timing
    private static final int SYNC_INTERVAL_MINUTES = 15;
    private static final int CLEANUP_INTERVAL_HOURS = 24;

    /**
     * Schedule periodic background sync
     */
    public static void schedulePeriodicSync(Context context) {
        Log.d(TAG, "Scheduling periodic sync");

        // Battery optimization: Don't sync when battery is low to preserve power
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)  // Don't sync on low battery
            .build();

        PeriodicWorkRequest syncRequest =
            new PeriodicWorkRequest.Builder(SyncWorker.class, SYNC_INTERVAL_MINUTES, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .addTag(PERIODIC_SYNC_WORK)
                .build();

        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(
                PERIODIC_SYNC_WORK,
                ExistingPeriodicWorkPolicy.KEEP,
                syncRequest
            );

        Log.d(TAG, "Periodic sync scheduled every " + SYNC_INTERVAL_MINUTES + " minutes");
    }

    /**
     * Schedule immediate sync (high priority)
     */
    public static void scheduleImmediateSync(Context context) {
        Log.d(TAG, "Scheduling immediate sync");

        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();

        OneTimeWorkRequest syncRequest =
            new OneTimeWorkRequest.Builder(SyncWorker.class)
                .setConstraints(constraints)
                .addTag(IMMEDIATE_SYNC_WORK)
                .build();

        WorkManager.getInstance(context)
            .enqueueUniqueWork(
                IMMEDIATE_SYNC_WORK,
                ExistingWorkPolicy.REPLACE,
                syncRequest
            );

        Log.d(TAG, "Immediate sync scheduled");
    }

    /**
     * Schedule periodic cleanup of old data
     */
    public static void scheduleCleanup(Context context) {
        Log.d(TAG, "Scheduling cleanup");

        PeriodicWorkRequest cleanupRequest =
            new PeriodicWorkRequest.Builder(CleanupWorker.class, CLEANUP_INTERVAL_HOURS, TimeUnit.HOURS)
                .addTag(CLEANUP_WORK)
                .build();

        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(
                CLEANUP_WORK,
                ExistingPeriodicWorkPolicy.KEEP,
                cleanupRequest
            );

        Log.d(TAG, "Cleanup scheduled every " + CLEANUP_INTERVAL_HOURS + " hours");
    }

    /**
     * Cancel all sync work
     */
    public static void cancelAll(Context context) {
        Log.d(TAG, "Cancelling all sync work");
        WorkManager.getInstance(context).cancelAllWork();
    }

    /**
     * Cancel periodic sync only
     */
    public static void cancelPeriodicSync(Context context) {
        Log.d(TAG, "Cancelling periodic sync");
        WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_SYNC_WORK);
    }

    /**
     * Check if sync work is pending or running
     */
    public static void checkPendingSync(Context context, SyncStatusCallback callback) {
        WorkManager.getInstance(context)
            .getWorkInfosForUniqueWork(PERIODIC_SYNC_WORK)
            .addListener(() -> {
                try {
                    java.util.List<WorkInfo> workInfos =
                        WorkManager.getInstance(context).getWorkInfosForUniqueWork(PERIODIC_SYNC_WORK).get();

                    if (workInfos.isEmpty()) {
                        callback.onStatus(false, false);
                        return;
                    }

                    WorkInfo.State state = workInfos.get(0).getState();
                    boolean isPending = state == WorkInfo.State.ENQUEUED ||
                                       state == WorkInfo.State.BLOCKED;
                    boolean isRunning = state == WorkInfo.State.RUNNING;

                    callback.onStatus(isPending, isRunning);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to check sync status", e);
                    callback.onStatus(false, false);
                }
            }, context.getMainExecutor());
    }

    /**
     * Callback interface for sync status
     */
    public interface SyncStatusCallback {
        void onStatus(boolean isPending, boolean isRunning);
    }
}
