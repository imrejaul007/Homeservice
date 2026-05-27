/**
 * Android Espresso Tests: Offline Sync
 * Tests for offline data persistence and sync functionality
 */

package com.nilin.app.tests

import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.SmallTest
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

import static androidx.test.espresso.Espresso.*
import static androidx.test.espresso.action.ViewActions.*
import static androidx.test.espresso.assertion.ViewAssertions.*
import static androidx.test.espresso.matcher.ViewMatchers.*

/**
 * Test class for offline sync functionality
 */
@RunWith(AndroidJUnit4::class)
class OfflineSyncTest {

    @Rule
    var activityScenarioRule = ActivityScenarioRule(MainActivity::class.java)

    /**
     * Test: Data persists when going offline
     */
    @Test
    fun testDataPersistenceWhenOffline() {
        // Login while online
        onView(withId(R.id.emailInput))
            .perform(typeText("test@test.com"), closeSoftKeyboard())

        onView(withId(R.id.passwordInput))
            .perform(typeText("password123"), closeSoftKeyboard())

        onView(withId(R.id.loginButton))
            .perform(click())

        Thread.sleep(3000)

        // Navigate to bookings
        onView(withId(R.id.bottomNavigation))
            .perform(click())

        onView(withText("Bookings"))
            .perform(click())

        Thread.sleep(2000)

        // Enable airplane mode
        Runtime.getRuntime().exec("settings put global airplane_mode_on 1")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true")

        Thread.sleep(2000)

        // Verify bookings list is still visible (from cache)
        onView(withId(R.id.bookingsList))
            .check(matches(isDisplayed()))

        // Disable airplane mode
        Runtime.getRuntime().exec("settings put global airplane_mode_on 0")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false")
    }

    /**
     * Test: Pending actions sync when coming back online
     */
    @Test
    fun testPendingActionsSyncWhenOnline() {
        // Enable airplane mode
        Runtime.getRuntime().exec("settings put global airplane_mode_on 1")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true")

        Thread.sleep(2000)

        // Login
        onView(withId(R.id.emailInput))
            .perform(typeText("test@test.com"), closeSoftKeyboard())

        onView(withId(R.id.passwordInput))
            .perform(typeText("password123"), closeSoftKeyboard())

        onView(withId(R.id.loginButton))
            .perform(click())

        Thread.sleep(3000)

        // Create booking while offline
        onView(withId(R.id.createBookingFab))
            .perform(click())

        Thread.sleep(1000)

        // Verify booking is queued
        onView(withText("Booking queued"))
            .check(matches(isDisplayed()))

        // Disable airplane mode
        Runtime.getRuntime().exec("settings put global airplane_mode_on 0")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false")

        Thread.sleep(3000)

        // Verify sync indicator appears
        onView(withId(R.id.syncIndicator))
            .check(matches(isDisplayed()))
    }

    /**
     * Test: Offline mode indicator shows correctly
     */
    @Test
    fun testOfflineModeIndicator() {
        // Enable airplane mode
        Runtime.getRuntime().exec("settings put global airplane_mode_on 1")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true")

        Thread.sleep(2000)

        // Verify offline indicator is shown
        onView(withText("You're offline"))
            .check(matches(isDisplayed()))

        // Disable airplane mode
        Runtime.getRuntime().exec("settings put global airplane_mode_on 0")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false")

        Thread.sleep(2000)

        // Verify offline indicator disappears
        onView(withText("You're offline"))
            .check(matches(not(isDisplayed())))
    }

    /**
     * Test: Cancel operation while offline
     */
    @Test
    fun testCancelOperationWhileOffline() {
        // Enable airplane mode
        Runtime.getRuntime().exec("settings put global airplane_mode_on 1")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true")

        Thread.sleep(2000)

        // Login
        onView(withId(R.id.emailInput))
            .perform(typeText("test@test.com"), closeSoftKeyboard())

        onView(withId(R.id.passwordInput))
            .perform(typeText("password123"), closeSoftKeyboard())

        onView(withId(R.id.loginButton))
            .perform(click())

        Thread.sleep(3000)

        // Navigate to bookings
        onView(withId(R.id.bottomNavigation))
            .perform(click())

        onView(withText("Bookings"))
            .perform(click())

        Thread.sleep(2000)

        // Try to cancel booking
        onView(withId(R.id.bookingsList))
            .perform(RecyclerViewActions.actionOnItemAtPosition<RecyclerView.ViewHolder>(0, click()))

        Thread.sleep(1000)

        onView(withText("Cancel"))
            .perform(click())

        Thread.sleep(500)

        // Verify queued for sync
        onView(withText("Cancellation queued"))
            .check(matches(isDisplayed()))

        // Disable airplane mode
        Runtime.getRuntime().exec("settings put global airplane_mode_on 0")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false")
    }

    /**
     * Test: Search works with cached data while offline
     */
    @Test
    fun testSearchWithCachedDataOffline() {
        // Login and browse services while online
        onView(withId(R.id.emailInput))
            .perform(typeText("test@test.com"), closeSoftKeyboard())

        onView(withId(R.id.passwordInput))
            .perform(typeText("password123"), closeSoftKeyboard())

        onView(withId(R.id.loginButton))
            .perform(click())

        Thread.sleep(3000)

        // Navigate to services
        onView(withId(R.id.bottomNavigation))
            .perform(click())

        onView(withText("Services"))
            .perform(click())

        Thread.sleep(2000)

        // Enable airplane mode
        Runtime.getRuntime().exec("settings put global airplane_mode_on 1")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true")

        Thread.sleep(2000)

        // Search for service
        onView(withId(R.id.searchInput))
            .perform(typeText("cleaning"), closeSoftKeyboard())

        Thread.sleep(1000)

        // Verify results shown from cache
        onView(withId(R.id.servicesList))
            .check(matches(isDisplayed()))

        // Disable airplane mode
        Runtime.getRuntime().exec("settings put global airplane_mode_on 0")
        Runtime.getRuntime().exec("am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false")
    }
}

/**
 * Test class for push notification handling
 */
@RunWith(AndroidJUnit4::class)
class PushNotificationTest {

    @Rule
    var activityScenarioRule = ActivityScenarioRule(MainActivity::class.java)

    /**
     * Test: Booking confirmation notification
     */
    @Test
    fun testBookingConfirmationNotification() {
        // Simulate booking confirmation notification
        val intent = android.content.Intent(
            "com.nilin.app.BOOKING_CONFIRMED"
        ).apply {
            putExtra("booking_id", "BK123456")
            putExtra("status", "confirmed")
            putExtra("provider_name", "John Provider")
            putExtra("booking_date", "Tomorrow at 10:00 AM")
            flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
        }

        InstrumentationRegistry.getInstrumentation().targetContext.sendBroadcast(intent)

        Thread.sleep(2000)

        // Verify notification details shown
        onView(withText("Booking Confirmed"))
            .check(matches(isDisplayed()))

        onView(withText("John Provider"))
            .check(matches(isDisplayed()))

        // Tap to view booking
        onView(withText("View Booking"))
            .perform(click())

        Thread.sleep(2000)

        // Verify booking details screen
        onView(withId(R.id.bookingDetailsContainer))
            .check(matches(isDisplayed()))
    }

    /**
     * Test: Reminder notification
     */
    @Test
    fun testReminderNotification() {
        val intent = android.content.Intent(
            "com.nilin.app.REMINDER"
        ).apply {
            putExtra("booking_id", "BK123456")
            putExtra("hours_until", "2")
            putExtra("service_name", "House Cleaning")
            flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
        }

        InstrumentationRegistry.getInstrumentation().targetContext.sendBroadcast(intent)

        Thread.sleep(2000)

        onView(withText("Reminder"))
            .check(matches(isDisplayed()))

        onView(withText("House Cleaning"))
            .check(matches(isDisplayed()))

        onView(withText("2 hours"))
            .check(matches(isDisplayed()))
    }

    /**
     * Test: Payment received notification
     */
    @Test
    fun testPaymentReceivedNotification() {
        val intent = android.content.Intent(
            "com.nilin.app.PAYMENT_RECEIVED"
        ).apply {
            putExtra("amount", "250.00")
            putExtra("currency", "AED")
            putExtra("booking_id", "BK123456")
            flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
        }

        InstrumentationRegistry.getInstrumentation().targetContext.sendBroadcast(intent)

        Thread.sleep(2000)

        onView(withText("Payment Received"))
            .check(matches(isDisplayed()))

        onView(withText("AED 250.00"))
            .check(matches(isDisplayed()))
    }
}
