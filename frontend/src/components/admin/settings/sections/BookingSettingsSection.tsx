import React from 'react';
import type { SettingsSectionProps } from '../settingsSectionTypes';
import { NumberInput, SectionDivider, SettingRow, ToggleSwitch } from '../SettingsPrimitives';

export const BookingSettingsSection: React.FC<SettingsSectionProps> = ({ settings, onChange }) => (
  <div className="space-y-1">
    <SectionDivider label="Booking Configuration" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
      <SettingRow label="Default Booking Buffer" description="Minutes before booking start time">
        <NumberInput value={settings.defaultBookingBufferMinutes} onChange={(v) => onChange('defaultBookingBufferMinutes', v)} min={0} suffix="min" />
      </SettingRow>
      <SettingRow label="Cancellation Window" description="Hours before booking to allow cancellation">
        <NumberInput value={settings.cancellationWindowHours} onChange={(v) => onChange('cancellationWindowHours', v)} min={0} suffix="hrs" />
      </SettingRow>
      <SettingRow label="Max Booking Advance Days" description="Maximum days in advance users can book">
        <NumberInput value={settings.maxBookingAdvanceDays} onChange={(v) => onChange('maxBookingAdvanceDays', v)} min={1} suffix="days" />
      </SettingRow>
      <SettingRow label="Min Booking Advance Hours" description="Minimum hours before booking time">
        <NumberInput value={settings.minBookingAdvanceHours} onChange={(v) => onChange('minBookingAdvanceHours', v)} min={0} suffix="hrs" />
      </SettingRow>
    </div>

    <SectionDivider label="Auto Features" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
      <SettingRow label="Auto-Assignment" description="Automatically assign providers to bookings">
        <ToggleSwitch enabled={settings.autoAssignmentEnabled} onChange={(v) => onChange('autoAssignmentEnabled', v)} />
      </SettingRow>
      <SettingRow label="Auto-Confirm Bookings" description="Automatically confirm bookings without manual approval">
        <ToggleSwitch enabled={settings.autoConfirmEnabled} onChange={(v) => onChange('autoConfirmEnabled', v)} />
      </SettingRow>
      <SettingRow label="Instant Booking" description="Allow customers to book instantly without provider approval">
        <ToggleSwitch enabled={settings.instantBooking} onChange={(v) => onChange('instantBooking', v)} />
      </SettingRow>
    </div>

    <SectionDivider label="Booking Limits" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
      <SettingRow label="Max Bookings Per Day" description="Maximum bookings per user per day">
        <NumberInput value={settings.maxDailyBookings} onChange={(v) => onChange('maxDailyBookings', v)} min={1} suffix="bookings" />
      </SettingRow>
    </div>
  </div>
);
