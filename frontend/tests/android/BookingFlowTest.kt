/**
 * Android Espresso Tests: Booking Flow
 * UI tests for native Android app using Espresso
 */

package com.nilin.app.tests

import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.platform.app.InstrumentationRegistry
import com.nilin.app.MainActivity
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

import static androidx.test.espresso.Espresso.*
import static androidx.test.espresso.action.ViewActions.*
import static androidx.test.espresso.assertion.ViewAssertions.*
import static androidx.test.espresso.matcher.ViewMatchers.*

/**
 * Test class for booking flow in Android app
 */
@RunWith(AndroidJUnit4::class)
class BookingFlowTest {

    @Rule
    var activityScenarioRule = ActivityScenarioRule(MainActivity::class.java)

    private var uniqueEmail: String = ""

    @Before
    fun setup() {
        // Generate unique test email
        val timestamp = System.currentTimeMillis()
        val random = (Math.random() * 10000).toInt()
        uniqueEmail = "android_test_${timestamp}_${random}@test.com"
    }

    /**
     * Test: Deep link handling for booking
     */
    @Test
    fun testDeepLinkBookingFlow() {
        // Launch with deep link
        val intent = android.content.Intent(
            android.content.Context(InstrumentationRegistry.getInstrumentation().targetContext, MainActivity::class.java)
        ).apply {
            data = android.net.Uri.parse("nilin://book/service/cleaning")
            flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
        }

        InstrumentationRegistry.getInstrumentation().startActivitySync(intent)

        // Wait for navigation
        Thread.sleep(2000)

        // Verify service page loaded
        onView(withId(R.id.serviceDetailContainer))
            .check(matches(isDisplayed()))
    }

    /**
     * Test: Complete booking flow
     */
    @Test
    fun testCompleteBookingFlow() {
        // Step 1: Navigate to services
        onView(withId(R.id.bottomNavigation))
            .perform(click())

        onView(withText("Services"))
            .perform(click())

        Thread.sleep(1000)

        // Step 2: Select a service
        onView(withId(R.id.servicesList))
            .perform(RecyclerViewActions.actionOnItemAtPosition<RecyclerView.ViewHolder>(0, click()))

        Thread.sleep(1000)

        // Step 3: Tap Book button
        onView(withText("Book"))
            .perform(click())

        Thread.sleep(1000)

        // Step 4: Select date
        onView(withId(R.id.datePicker))
            .perform(click())

        onView(withText("OK"))
            .perform(click())

        Thread.sleep(500)

        // Step 5: Select time slot
        onView(withId(R.id.timeSlotGrid))
            .perform(RecyclerViewActions.actionOnItemAtPosition<RecyclerView.ViewHolder>(0, click()))

        Thread.sleep(500)

        // Step 6: Enter address
        onView(withId(R.id.streetInput))
            .perform(typeText("123 Test Street"), closeSoftKeyboard())

        onView(withId(R.id.cityInput))
            .perform(typeText("Dubai"), closeSoftKeyboard())

        // Step 7: Continue to checkout
        onView(withText("Continue"))
            .perform(click())

        Thread.sleep(2000)

        // Step 8: Verify checkout page
        onView(withId(R.id.checkoutContainer))
            .check(matches(isDisplayed()))
    }

    /**
     * Test: Offline booking creation
     */
    @Test
    fun testOfflineBooking() {
        // Enable airplane mode via ADB
        Runtime.getRuntime().exec("settings put global airplane_mode_on 1")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true")

        Thread.sleep(2000)

        // Navigate to booking
        onView(withId(R.id.bottomNavigation))
            .perform(click())

        onView(withText("Bookings"))
            .perform(click())

        Thread.sleep(1000)

        // Try to create booking offline
        onView(withId(R.id.createBookingFab))
            .perform(click())

        Thread.sleep(1000)

        // Verify offline message shown
        onView(withText("You're offline"))
            .check(matches(isDisplayed()))

        // Disable airplane mode
        Runtime.getRuntime().exec("settings put global airplane_mode_on 0")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false")
    }

    /**
     * Test: Push notification handling
     */
    @Test
    fun testPushNotificationBooking() {
        // Simulate push notification
        val notificationManager = InstrumentationRegistry.getInstrumentation()
            .targetContext
            .getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager

        val bookingConfirmedIntent = android.content.Intent(
            "com.nilin.app.BOOKING_CONFIRMED"
        ).apply {
            putExtra("booking_id", "test_booking_123")
            flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
        }

        // Send broadcast to simulate notification tap
        InstrumentationRegistry.getInstrumentation().targetContext.sendBroadcast(bookingConfirmedIntent)

        Thread.sleep(2000)

        // Verify booking details screen opened
        onView(withId(R.id.bookingDetailsContainer))
            .check(matches(isDisplayed()))
    }

    /**
     * Test: Booking cancellation
     */
    @Test
    fun testCancelBooking() {
        // Navigate to my bookings
        onView(withId(R.id.bottomNavigation))
            .perform(click())

        onView(withText("Bookings"))
            .perform(click())

        Thread.sleep(2000)

        // Tap on first booking
        onView(withId(R.id.bookingsList))
            .perform(RecyclerViewActions.actionOnItemAtPosition<RecyclerView.ViewHolder>(0, click()))

        Thread.sleep(1000)

        // Tap cancel
        onView(withText("Cancel"))
            .perform(click())

        Thread.sleep(500)

        // Confirm cancellation
        onView(withText("Confirm"))
            .perform(click())

        Thread.sleep(1000)

        // Verify cancellation
        onView(withText("Booking Cancelled"))
            .check(matches(isDisplayed()))
    }
}

/**
 * Test class for offline sync functionality
 */
@RunWith(AndroidJUnit4::class)
class OfflineSyncTest {

    @Rule
    var activityScenarioRule = ActivityScenarioRule(MainActivity::class.java)

    /**
     * Test: Data persists offline
     */
    @Test
    fun testDataPersistenceOffline() {
        // Login and create data
        onView(withId(R.id.emailInput))
            .perform(typeText("test@test.com"), closeSoftKeyboard())

        onView(withId(R.id.passwordInput))
            .perform(typeText("password123"), closeSoftKeyboard())

        onView(withId(R.id.loginButton))
            .perform(click())

        Thread.sleep(3000)

        // Enable airplane mode
        Runtime.getRuntime().exec("settings put global airplane_mode_on 1")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true")

        Thread.sleep(2000)

        // Navigate - data should still be visible
        onView(withId(R.id.bottomNavigation))
            .perform(click())

        onView(withText("Bookings"))
            .perform(click())

        Thread.sleep(1000)

        // Verify previously loaded data is shown
        onView(withId(R.id.bookingsList))
            .check(matches(isDisplayed()))

        // Disable airplane mode
        Runtime.getRuntime().exec("settings put global airplane_mode_on 0")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false")
    }

    /**
     * Test: Pending actions sync when online
     */
    @Test
    fun testPendingActionsSync() {
        // Create booking while offline
        Runtime.getRuntime().exec("settings put global airplane_mode_on 1")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true")

        Thread.sleep(2000)

        // Create a booking (queued)
        onView(withId(R.id.createBookingFab))
            .perform(click())

        Thread.sleep(1000)

        // Verify queued message
        onView(withText("Booking queued"))
            .check(matches(isDisplayed()))

        // Go back online
        Runtime.getRuntime().exec("settings put global airplane_mode_on 0")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false")

        Thread.sleep(3000)

        // Verify sync indicator
        onView(withId(R.id.syncIndicator))
            .check(matches(isDisplayed()))
    }
}
