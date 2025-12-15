// Geolocation utilities for fraud detection
const geoip = require('geoip-lite');
const db = require('../../database');

/**
 * Get geolocation data from IP address
 * @param {string} ip - IP address
 * @returns {Object} Geolocation data
 */
const getLocationFromIP = (ip) => {
  try {
    // Handle localhost and private IPs
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return {
        ip: ip || 'unknown',
        country: 'Local',
        city: 'Local',
        latitude: null,
        longitude: null
      };
    }

    const geo = geoip.lookup(ip);

    if (!geo) {
      return {
        ip,
        country: 'Unknown',
        city: 'Unknown',
        latitude: null,
        longitude: null
      };
    }

    return {
      ip,
      country: geo.country,
      city: geo.city || 'Unknown',
      latitude: geo.ll ? geo.ll[0] : null,
      longitude: geo.ll ? geo.ll[1] : null,
      timezone: geo.timezone
    };
  } catch (error) {
    console.error('Geolocation lookup error:', error);
    return {
      ip: ip || 'unknown',
      country: 'Unknown',
      city: 'Unknown',
      latitude: null,
      longitude: null
    };
  }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if location change is suspicious (geo-velocity check)
 * @param {number} userId - User ID
 * @param {Object} currentLocation - Current location data
 * @returns {Object} Location change analysis
 */
const checkLocationChange = async (userId, currentLocation) => {
  try {
    // Get the user's most recent transaction location
    const lastLog = db.prepare(`
      SELECT ip_address, country, city, latitude, longitude, created_at
      FROM fraud_logs
      WHERE user_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `).get(userId);

    // If no previous location, this is first transaction
    if (!lastLog || !currentLocation.latitude || !currentLocation.longitude) {
      return {
        locationChanged: false,
        suspicious: false,
        distance: 0,
        timeDiff: 0,
        speed: 0
      };
    }

    // Calculate distance between locations
    const distance = calculateDistance(
      lastLog.latitude,
      lastLog.longitude,
      currentLocation.latitude,
      currentLocation.longitude
    );

    // Calculate time difference in hours
    const lastTime = new Date(lastLog.created_at);
    const currentTime = new Date();
    const timeDiffMs = currentTime - lastTime;
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

    // Calculate average speed (km/h)
    const speed = timeDiffHours > 0 ? distance / timeDiffHours : 0;

    // Check if location changed significantly
    const locationChanged = distance > 50; // More than 50km

    // Detect impossible travel (faster than 800 km/h ~ plane speed)
    const suspicious = speed > 800 || (distance > 500 && timeDiffHours < 1);

    return {
      locationChanged,
      suspicious,
      distance: Math.round(distance),
      timeDiff: Math.round(timeDiffHours * 100) / 100,
      speed: Math.round(speed),
      previousLocation: {
        country: lastLog.country,
        city: lastLog.city,
        ip: lastLog.ip_address
      },
      message: suspicious
        ? `Impossible travel detected: ${Math.round(distance)}km in ${Math.round(timeDiffHours * 60)} minutes (${Math.round(speed)} km/h)`
        : locationChanged
        ? `Location changed: ${lastLog.city}, ${lastLog.country} → ${currentLocation.city}, ${currentLocation.country}`
        : 'Same location'
    };
  } catch (error) {
    console.error('Location change check error:', error);
    return {
      locationChanged: false,
      suspicious: false,
      distance: 0,
      timeDiff: 0,
      speed: 0
    };
  }
};

/**
 * Get user's location history
 * @param {number} userId - User ID
 * @param {number} limit - Number of records to return
 * @returns {Array} Location history
 */
const getLocationHistory = (userId, limit = 10) => {
  try {
    return db.prepare(`
      SELECT
        ip_address,
        country,
        city,
        latitude,
        longitude,
        location_changed,
        created_at
      FROM fraud_logs
      WHERE user_id = ? AND ip_address IS NOT NULL
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, limit);
  } catch (error) {
    console.error('Get location history error:', error);
    return [];
  }
};

module.exports = {
  getLocationFromIP,
  calculateDistance,
  checkLocationChange,
  getLocationHistory
};
