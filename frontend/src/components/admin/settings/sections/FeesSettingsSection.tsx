import React from 'react';
import type { PlatformSettings } from '../../../../types/platformSettings';
import type { SettingsSectionProps } from '../settingsSectionTypes';
import { NumberInput, SectionDivider, SettingRow } from '../SettingsPrimitives';

export const FeesSettingsSection: React.FC<SettingsSectionProps> = ({ settings, onChange }) => (
  <div className="space-y-1">
    <SectionDivider label="Platform Fees" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
      <SettingRow label="Commission Rate" description="Percentage charged on each transaction">
        <NumberInput value={settings.commissionRate} onChange={(v) => onChange('commissionRate', v)} min={0} max={100} step={0.1} suffix="%" />
      </SettingRow>
      <SettingRow label="Payment Processing Fee" description="Percentage charged for payment processing">
        <NumberInput value={settings.paymentProcessingFee} onChange={(v) => onChange('paymentProcessingFee', v)} min={0} max={100} step={0.1} suffix="%" />
      </SettingRow>
      <SettingRow label="Minimum Withdrawal Amount" description="Minimum amount providers can withdraw">
        <NumberInput
          value={settings.minimumWithdrawalAmount}
          onChange={(v) => onChange('minimumWithdrawalAmount', v)}
          min={0}
          suffix={settings.currency}
        />
      </SettingRow>
      <SettingRow label="Platform Fee Type" description="How platform fees are calculated">
        <select
          value={settings.platformFeeType}
          onChange={(e) => onChange('platformFeeType', e.target.value as PlatformSettings['platformFeeType'])}
          className="w-36 px-3 py-2 border border-nilin-border rounded-xl bg-white text-sm font-sans"
        >
          <option value="percentage">Percentage</option>
          <option value="fixed">Fixed Amount</option>
          <option value="both">Both</option>
        </select>
      </SettingRow>
    </div>

    <SectionDivider label="Fee Customization" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
      <SettingRow label="Tax Rate" description="Additional tax percentage applied to bookings">
        <NumberInput value={settings.taxRate} onChange={(v) => onChange('taxRate', v)} min={0} max={100} suffix="%" />
      </SettingRow>
      <SettingRow label="Weekend Rates" description="Additional percentage for weekend bookings">
        <NumberInput value={settings.weekendRates} onChange={(v) => onChange('weekendRates', v)} min={0} max={100} suffix="%" />
      </SettingRow>
      <SettingRow label="Holiday Rates" description="Additional percentage for holiday bookings">
        <NumberInput value={settings.holidayRates} onChange={(v) => onChange('holidayRates', v)} min={0} max={100} suffix="%" />
      </SettingRow>
    </div>
  </div>
);
