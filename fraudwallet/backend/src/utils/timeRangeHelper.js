/**
 * Time Range Helper Utilities
 * Converts time range strings to SQLite datetime expressions
 */

const TIME_RANGES = {
  '1m': '-1 minutes',
  '1h': '-1 hours',
  '3h': '-3 hours',
  '12h': '-12 hours',
  '1d': '-1 days',
  '3d': '-3 days',
  '7d': '-7 days',
  'all': null
};

/**
 * Convert time range string to SQLite datetime modifier
 * @param {string} timeRange - Time range key (1m, 1h, 3h, etc.)
 * @returns {string|null} SQLite datetime modifier or null for all-time
 */
function getDateTimeModifier(timeRange = '1d') {
  // Backward compatibility: convert old format
  if (timeRange === '24h') timeRange = '1d';

  return TIME_RANGES[timeRange] || TIME_RANGES['1d'];
}

/**
 * Get SQL WHERE clause for time filtering
 * @param {string} timeRange - Time range key
 * @param {string} columnName - Column name to filter (default: created_at)
 * @returns {string} SQL WHERE clause or empty string
 */
function getTimeFilterSQL(timeRange = '1d', columnName = 'created_at') {
  const modifier = getDateTimeModifier(timeRange);

  if (modifier === null) {
    return ''; // No filter for all-time
  }

  return `${columnName} >= datetime('now', '${modifier}')`;
}

/**
 * Get human-readable label for time range
 * @param {string} timeRange
 * @returns {string}
 */
function getTimeRangeLabel(timeRange) {
  const labels = {
    '1m': '1 Minute',
    '1h': '1 Hour',
    '3h': '3 Hours',
    '12h': '12 Hours',
    '1d': '1 Day',
    '3d': '3 Days',
    '7d': '1 Week',
    'all': 'All Time'
  };

  return labels[timeRange] || labels['1d'];
}

/**
 * Validate time range parameter
 * @param {string} timeRange
 * @returns {boolean}
 */
function isValidTimeRange(timeRange) {
  return Object.keys(TIME_RANGES).includes(timeRange);
}

module.exports = {
  getDateTimeModifier,
  getTimeFilterSQL,
  getTimeRangeLabel,
  isValidTimeRange,
  TIME_RANGES
};
