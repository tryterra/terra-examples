import { normalizeUpdateType } from '../src/producer/normalizeType';

describe('normalizeUpdateType', () => {
  test('strips workout prefixes from watch samples', () => {
    expect(normalizeUpdateType('RUNNING_HEART_RATE')).toBe('HEART_RATE');
    expect(normalizeUpdateType('RUNNING_TREADMILL_DISTANCE')).toBe('DISTANCE');
    expect(normalizeUpdateType('RUNNING_DURATION')).toBe('DURATION');
  });

  test('folds SDK names onto registry names', () => {
    expect(normalizeUpdateType('TOTAL_CALORIES')).toBe('CALORIES');
    expect(normalizeUpdateType('RUNNING_TOTAL_CALORIES')).toBe('CALORIES');
    expect(normalizeUpdateType('FLIGHTS_CLIMBED')).toBe('FLOORS_CLIMBED');
  });

  test('longest match wins — HRV is not mistaken for HEART_RATE', () => {
    expect(normalizeUpdateType('RUNNING_HEART_RATE_VARIABILITY')).toBe('HRV');
    expect(normalizeUpdateType('HEART_RATE_VARIABILITY')).toBe('HRV');
  });

  test('plain and unknown types pass through untouched', () => {
    expect(normalizeUpdateType('HEART_RATE')).toBe('HEART_RATE');
    expect(normalizeUpdateType('ECG')).toBe('ECG');
    expect(normalizeUpdateType('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
});
