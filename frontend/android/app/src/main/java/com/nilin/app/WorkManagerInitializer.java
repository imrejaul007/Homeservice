package com.nilin.app;

import android.content.Context;
import androidx.work.Configuration;
import androidx.work.WorkManager;

public class WorkManagerInitializer implements Configuration.Provider {
    private final Context context;

    public WorkManagerInitializer(Context context) {
        this.context = context;
    }

    @Override
    public Configuration getWorkManagerConfiguration() {
        return new Configuration.Builder()
            .setMinimumLoggingLevel(android.util.Log.INFO)
            .build();
    }
}
