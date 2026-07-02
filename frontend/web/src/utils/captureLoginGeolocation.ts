export type LoginGeolocation = {
  latitude: number;
  longitude: number;
  locationAccuracyMeters: number;
};

/** Device GPS for audit trail — requires HTTPS and browser permission. */
export function captureLoginGeolocation(timeoutMs = 12000): Promise<LoginGeolocation | null> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          locationAccuracyMeters: Math.round(pos.coords.accuracy),
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      },
    );
  });
}
