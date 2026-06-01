/**
 * Shared trip generation constants.
 *
 * Single source of truth for AI trip duration limits. The frontend mirrors
 * MAX_AI_TRIP_DAYS in CreateTripScreen for inline UX validation, but the
 * backend is authoritative — the DTO validator and trips.service runtime check
 * both enforce this value, so a client that bypasses the UI is still rejected.
 *
 * Duration is inclusive of both the start and end dates, matching the
 * `numberOfDays = ceil((end - start) / DAY) + 1` calculation used across the
 * codebase. So 31 means a trip from the 1st to the 31st of a month is allowed.
 */
export const MAX_AI_TRIP_DAYS = 31;
