/**
 * Service Availability API
 *
 * API endpoints for managing per-service/bundle availability
 * so providers can set different availability for specific services/packages.
 */

import { authService } from './AuthService';

export interface TimeSlot {
  startTime: string;
  endTime: string;
  isBooked?: boolean;
  maxBookings?: number;
  currentBookings?: number;
}

export interface DaySchedule {
  isAvailable: boolean;
  timeSlots: TimeSlot[];
}

export interface ServiceSchedule {
  [day: string]: DaySchedule;
}

export interface ServiceScheduleResponse {
  serviceId: string;
  hasSchedule: boolean;
  schedule: ServiceSchedule | null;
  usesGlobal: boolean;
}

export interface AllServiceSchedulesResponse {
  serviceSchedules: {
    [serviceId: string]: ServiceSchedule;
  };
  count: number;
  servicesWithCustomSchedule: string[];
  globalSchedule: ServiceSchedule | null;
}

/**
 * Get availability schedule for a specific service
 */
export const getServiceSchedule = async (serviceId: string): Promise<ServiceScheduleResponse> => {
  const response = await authService.get<{ data: ServiceScheduleResponse }>(
    `/availability/service/${serviceId}/schedule`
  );
  return response.data.data;
};

/**
 * Update availability schedule for a specific service
 */
export const updateServiceSchedule = async (
  serviceId: string,
  schedule: ServiceSchedule,
  useGlobal: boolean = false
): Promise<ServiceScheduleResponse> => {
  const response = await authService.put<{ data: ServiceScheduleResponse }>(
    `/availability/service/${serviceId}/schedule`,
    { schedule, useGlobal }
  );
  return response.data.data;
};

/**
 * Get all service schedules for the provider
 */
export const getAllServiceSchedules = async (): Promise<AllServiceSchedulesResponse> => {
  const response = await authService.get<{ data: AllServiceSchedulesResponse }>(
    '/availability/service/schedules'
  );
  return response.data.data;
};

/**
 * Copy global schedule to a specific service
 */
export const copyGlobalToService = async (serviceId: string): Promise<{ serviceId: string; schedule: ServiceSchedule }> => {
  const response = await authService.post<{ data: { serviceId: string; schedule: ServiceSchedule } }>(
    `/availability/service/${serviceId}/copy-global`
  );
  return response.data.data;
};

/**
 * Create default 30-minute slot schedule
 */
export const createDefaultSchedule = (): ServiceSchedule => {
  const createSlots = (startHour: number, endHour: number): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    for (let hour = startHour; hour < endHour; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const start = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const endHourCalc = min + 30 >= 60 ? hour + 1 : hour;
        const endMinCalc = min + 30 >= 60 ? 0 : min + 30;
        const end = `${endHourCalc.toString().padStart(2, '0')}:${endMinCalc.toString().padStart(2, '0')}`;
        slots.push({
          startTime: start,
          endTime: end,
          isBooked: false,
          maxBookings: 2,
          currentBookings: 0,
        });
      }
    }
    return slots;
  };

  return {
    monday: { isAvailable: true, timeSlots: createSlots(9, 20) },
    tuesday: { isAvailable: true, timeSlots: createSlots(9, 20) },
    wednesday: { isAvailable: true, timeSlots: createSlots(9, 20) },
    thursday: { isAvailable: true, timeSlots: createSlots(9, 20) },
    friday: { isAvailable: true, timeSlots: createSlots(10, 18) },
    saturday: { isAvailable: true, timeSlots: createSlots(9, 20) },
    sunday: { isAvailable: true, timeSlots: createSlots(9, 20) },
  };
};

export const serviceAvailabilityApi = {
  getServiceSchedule,
  updateServiceSchedule,
  getAllServiceSchedules,
  copyGlobalToService,
  createDefaultSchedule,
};
