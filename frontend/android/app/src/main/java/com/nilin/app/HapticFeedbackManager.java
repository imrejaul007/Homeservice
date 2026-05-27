package com.nilin.app;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;

/**
 * NILIN Premium Haptic Feedback Manager
 *
 * Provides high-performance haptic feedback patterns for premium user experience.
 * Uses pre-created VibrationEffect objects for minimal latency.
 * Supports Android 12+ with VibratorManager fallback.
 */
public class HapticFeedbackManager {

    private static final String TAG = "NILIN/HapticFeedback";

    // Singleton instance
    private static HapticFeedbackManager instance;

    // Vibrator reference
    private Vibrator vibrator;

    // Pre-created vibration effects for minimal latency
    private final VibrationEffect EFFECT_TICK;
    private final VibrationEffect EFFECT_CLICK;
    private final VibrationEffect EFFECT_SUCCESS;
    private final VibrationEffect EFFECT_ERROR;
    private final VibrationEffect EFFECT_WARNING;
    private final VibrationEffect EFFECT_HEAVY;
    private final VibrationEffect EFFECT_PREMIUM;

    // Pattern definitions
    public static final String PATTERN_TICK = "tick";
    public static final String PATTERN_CLICK = "click";
    public static final String PATTERN_SUCCESS = "success";
    public static final String PATTERN_ERROR = "error";
    public static final String PATTERN_WARNING = "warning";
    public static final String PATTERN_HEAVY = "heavy";
    public static final String PATTERN_PREMIUM = "premium";

    /**
     * Private constructor - singleton pattern
     */
    private HapticFeedbackManager(Context context) {
        // Initialize vibrator with Android 12+ support
        initializeVibrator(context);

        // Pre-create all vibration effects for instant playback
        EFFECT_TICK = createTickEffect();
        EFFECT_CLICK = createClickEffect();
        EFFECT_SUCCESS = createSuccessEffect();
        EFFECT_ERROR = createErrorEffect();
        EFFECT_WARNING = createWarningEffect();
        EFFECT_HEAVY = createHeavyEffect();
        EFFECT_PREMIUM = createPremiumEffect();

        Log.d(TAG, "HapticFeedbackManager initialized");
    }

    /**
     * Get singleton instance
     */
    public static synchronized HapticFeedbackManager getInstance(Context context) {
        if (instance == null) {
            instance = new HapticFeedbackManager(context.getApplicationContext());
        }
        return instance;
    }

    /**
     * Initialize vibrator with Android 12+ VibratorManager support
     */
    private void initializeVibrator(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vibratorManager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            if (vibratorManager != null) {
                vibrator = vibratorManager.getDefaultVibrator();
            }
        } else {
            vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        }

        if (vibrator == null) {
            Log.w(TAG, "Vibrator not available on this device");
        } else if (!vibrator.hasVibrator()) {
            Log.w(TAG, "Device does not have a vibrator");
            vibrator = null;
        }
    }

    /**
     * Check if haptic feedback is available
     */
    public boolean isAvailable() {
        return vibrator != null && vibrator.hasVibrator();
    }

    /**
     * Check if amplitude control is supported
     */
    public boolean hasAmplitudeControl() {
        return vibrator != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && vibrator.hasAmplitudeControl();
    }

    // =========================================================================
    // Effect Factory Methods
    // =========================================================================

    /**
     * Tick effect: 5ms duration, 30 amplitude - subtle UI feedback
     */
    private VibrationEffect createTickEffect() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return VibrationEffect.createOneShot(5, 30);
        }
        return VibrationEffect.createOneShot(5, 255);
    }

    /**
     * Click effect: 10ms duration, default amplitude - standard button feedback
     */
    private VibrationEffect createClickEffect() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return VibrationEffect.createOneShot(10, VibrationEffect.DEFAULT_AMPLITUDE);
        }
        return VibrationEffect.createOneShot(10, 200);
    }

    /**
     * Success effect: Double tap pattern - confirmation feedback
     */
    private VibrationEffect createSuccessEffect() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Double tap: two quick pulses
            long[] timings = {0, 30, 50, 30};
            int[] amplitudes = {0, 150, 0, 150};
            return VibrationEffect.createWaveform(timings, amplitudes, -1);
        }
        long[] pattern = {0, 30, 50, 30};
        return VibrationEffect.createWaveform(pattern, -1);
    }

    /**
     * Error effect: Triple pulse pattern - error feedback
     */
    private VibrationEffect createErrorEffect() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Triple pulse: three sharp pulses
            long[] timings = {0, 50, 50, 50, 50, 50};
            int[] amplitudes = {0, 200, 0, 200, 0, 200};
            return VibrationEffect.createWaveform(timings, amplitudes, -1);
        }
        long[] pattern = {0, 50, 50, 50, 50, 50};
        return VibrationEffect.createWaveform(pattern, -1);
    }

    /**
     * Warning effect: 40ms duration, 200 amplitude - caution feedback
     */
    private VibrationEffect createWarningEffect() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return VibrationEffect.createOneShot(40, 200);
        }
        return VibrationEffect.createOneShot(40, 200);
    }

    /**
     * Heavy effect: 50ms duration, 255 amplitude - significant feedback
     */
    private VibrationEffect createHeavyEffect() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return VibrationEffect.createOneShot(50, 255);
        }
        return VibrationEffect.createOneShot(50, 255);
    }

    /**
     * Premium effect: Sweep pattern - luxurious feedback
     */
    private VibrationEffect createPremiumEffect() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Rising sweep: gradual intensity increase then decrease
            long[] timings = {0, 10, 10, 15, 10, 20, 10, 25, 10, 20, 10, 15, 10, 10};
            int[] amplitudes = {0, 50, 80, 110, 140, 170, 200, 230, 200, 170, 140, 110, 80, 50};
            return VibrationEffect.createWaveform(timings, amplitudes, -1);
        }
        long[] pattern = {0, 20, 30, 40, 50, 40, 30, 20};
        return VibrationEffect.createWaveform(pattern, -1);
    }

    // =========================================================================
    // Public API Methods
    // =========================================================================

    /**
     * Perform haptic feedback by pattern name
     *
     * @param pattern The pattern name (tick, click, success, error, warning, heavy, premium)
     */
    public void perform(String pattern) {
        if (!isAvailable()) {
            return;
        }

        try {
            switch (pattern) {
                case PATTERN_TICK:
                    vibrator.vibrate(EFFECT_TICK);
                    break;
                case PATTERN_CLICK:
                    vibrator.vibrate(EFFECT_CLICK);
                    break;
                case PATTERN_SUCCESS:
                    vibrator.vibrate(EFFECT_SUCCESS);
                    break;
                case PATTERN_ERROR:
                    vibrator.vibrate(EFFECT_ERROR);
                    break;
                case PATTERN_WARNING:
                    vibrator.vibrate(EFFECT_WARNING);
                    break;
                case PATTERN_HEAVY:
                    vibrator.vibrate(EFFECT_HEAVY);
                    break;
                case PATTERN_PREMIUM:
                    vibrator.vibrate(EFFECT_PREMIUM);
                    break;
                default:
                    // Default to click for unknown patterns
                    vibrator.vibrate(EFFECT_CLICK);
                    break;
            }
            Log.v(TAG, "Haptic performed: " + pattern);
        } catch (Exception e) {
            Log.e(TAG, "Failed to perform haptic: " + e.getMessage());
        }
    }

    /**
     * Button click feedback - standard interaction
     */
    public void onButtonClick() {
        perform(PATTERN_CLICK);
    }

    /**
     * Success feedback - action completed
     */
    public void onSuccess() {
        perform(PATTERN_SUCCESS);
    }

    /**
     * Error feedback - action failed
     */
    public void onError() {
        perform(PATTERN_ERROR);
    }

    /**
     * Selection feedback - item selected
     */
    public void onSelection() {
        perform(PATTERN_TICK);
    }

    /**
     * Booking confirmed feedback - significant action completed
     */
    public void onBookingConfirmed() {
        perform(PATTERN_PREMIUM);
    }

    /**
     * Cancel/negative action feedback
     */
    public void onCancel() {
        perform(PATTERN_WARNING);
    }

    /**
     * Heavy interaction feedback - important action
     */
    public void onHeavyInteraction() {
        perform(PATTERN_HEAVY);
    }

    /**
     * Trigger haptic from JS bridge
     * Called by Capacitor plugin
     *
     * @param pattern The pattern name
     */
    public void triggerFromJS(String pattern) {
        perform(pattern);
    }

    /**
     * Cancel any ongoing vibration
     */
    public void cancel() {
        if (vibrator != null) {
            vibrator.cancel();
        }
    }
}
