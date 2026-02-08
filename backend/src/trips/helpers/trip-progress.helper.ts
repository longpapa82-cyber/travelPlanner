import { Trip, TripStatus } from '../entities/trip.entity';
import { Itinerary, Activity } from '../entities/itinerary.entity';

/**
 * 여행 진행 상태 관리 헬퍼
 * CLAUDE.md 프로세스 #6: 여행 시작 시, 이미 완료된 내용은 변경 불가
 */

/**
 * 현재 날짜/시간 기준으로 여행 상태 계산
 */
export function calculateTripStatus(trip: Trip, currentDate: Date = new Date()): TripStatus {
  const startDate = new Date(trip.startDate);
  const endDate = new Date(trip.endDate);

  // 시간 제거 (날짜만 비교)
  const current = new Date(currentDate.toDateString());
  const start = new Date(startDate.toDateString());
  const end = new Date(endDate.toDateString());

  if (current < start) {
    return TripStatus.UPCOMING;
  } else if (current > end) {
    return TripStatus.COMPLETED;
  } else {
    return TripStatus.ONGOING;
  }
}

/**
 * 특정 일정(Itinerary)이 완료되었는지 확인
 * @param itinerary 일정
 * @param tripTimezoneOffset 여행지 시간대 오프셋 (분 단위)
 */
export function isItineraryCompleted(
  itinerary: Itinerary,
  tripTimezoneOffset?: number,
): boolean {
  // 이미 완료 표시된 경우
  if (itinerary.isCompleted) {
    return true;
  }

  // 현재 시간 (여행지 시간대 적용)
  const now = new Date();
  const itineraryDate = new Date(itinerary.date);

  // 날짜만 비교 (시간 제거)
  const currentDate = new Date(now.toDateString());
  const targetDate = new Date(itineraryDate.toDateString());

  // 일정 날짜가 지난 경우 완료로 간주
  return currentDate > targetDate;
}

/**
 * 특정 활동(Activity)이 완료되었는지 확인
 * @param activity 활동
 * @param itineraryDate 일정 날짜
 * @param tripTimezoneOffset 여행지 시간대 오프셋 (분 단위)
 */
export function isActivityCompleted(
  activity: Activity,
  itineraryDate: Date,
  tripTimezoneOffset?: number,
): boolean {
  // 이미 완료 표시된 경우
  if (activity.completed) {
    return true;
  }

  // 활동 시간이 없으면 날짜만으로 판단
  if (!activity.time) {
    const now = new Date();
    const targetDate = new Date(itineraryDate);
    return new Date(now.toDateString()) > new Date(targetDate.toDateString());
  }

  // 활동 시간 파싱 (HH:MM 형식)
  const [hours, minutes] = activity.time.split(':').map(Number);

  // 활동 완료 시간 계산 (활동 시작 + 예상 소요 시간)
  const activityDateTime = new Date(itineraryDate);
  activityDateTime.setHours(hours, minutes, 0, 0);

  if (activity.estimatedDuration) {
    activityDateTime.setMinutes(activityDateTime.getMinutes() + activity.estimatedDuration);
  }

  // 현재 시간 (여행지 시간대 적용)
  const now = new Date();
  if (tripTimezoneOffset !== undefined) {
    // 현지 시간으로 변환
    const localOffset = now.getTimezoneOffset(); // 현재 로컬 오프셋 (분)
    now.setMinutes(now.getMinutes() + localOffset + tripTimezoneOffset);
  }

  // 활동 완료 시간이 지났는지 확인
  return now > activityDateTime;
}

/**
 * 여행이 수정 가능한 상태인지 확인
 */
export function isTripEditable(trip: Trip): boolean {
  return trip.status !== TripStatus.COMPLETED;
}

/**
 * 일정(Itinerary)이 수정 가능한 상태인지 확인
 */
export function isItineraryEditable(
  itinerary: Itinerary,
  trip: Trip,
  tripTimezoneOffset?: number,
): boolean {
  // 여행이 완료된 경우 수정 불가
  if (trip.status === TripStatus.COMPLETED) {
    return false;
  }

  // 일정이 완료된 경우 수정 불가
  if (isItineraryCompleted(itinerary, tripTimezoneOffset)) {
    return false;
  }

  return true;
}

/**
 * 활동(Activity)이 수정 가능한 상태인지 확인
 */
export function isActivityEditable(
  activity: Activity,
  itineraryDate: Date,
  trip: Trip,
  tripTimezoneOffset?: number,
): boolean {
  // 여행이 완료된 경우 수정 불가
  if (trip.status === TripStatus.COMPLETED) {
    return false;
  }

  // 활동이 완료된 경우 수정 불가
  if (isActivityCompleted(activity, itineraryDate, tripTimezoneOffset)) {
    return false;
  }

  return true;
}

/**
 * 일정의 모든 활동에 완료 상태 업데이트
 */
export function updateActivitiesCompletionStatus(
  itinerary: Itinerary,
  tripTimezoneOffset?: number,
): Activity[] {
  return itinerary.activities.map(activity => ({
    ...activity,
    completed: isActivityCompleted(activity, itinerary.date, tripTimezoneOffset),
  }));
}

/**
 * 여행의 모든 일정에 완료 상태 업데이트
 */
export function updateItinerariesCompletionStatus(
  itineraries: Itinerary[],
  tripTimezoneOffset?: number,
): Itinerary[] {
  return itineraries.map(itinerary => ({
    ...itinerary,
    isCompleted: isItineraryCompleted(itinerary, tripTimezoneOffset),
    activities: updateActivitiesCompletionStatus(itinerary, tripTimezoneOffset),
  }));
}
