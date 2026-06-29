export const isAbortError = (error: any): boolean => {
  if (!error) return false;
  
  // Handle cases where error might be an object with a message or a string
  const message = String(error.message || (typeof error === 'string' ? error : JSON.stringify(error))).toLowerCase();
  const name = String(error.name || '').toLowerCase();
  const code = String(error.code || (error.cause?.code) || '').toLowerCase();
  
  return (
    name === 'aborterror' ||
    message.includes('aborted') ||
    message.includes('cancelled') ||
    message.includes('canceled') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('user aborted') ||
    message.includes('request aborted') ||
    message.includes('the user aborted a request') ||
    message.includes('load failed') ||
    message.includes('fetch failed') ||
    code === 'cancelled' ||
    code === 'canceled' ||
    code === 'storage/canceled' ||
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'auth/network-request-failed'
  );
};

export const cleanObject = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj
      .map(item => cleanObject(item))
      .filter(item => item !== undefined);
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, cleanObject(value)])
    );
  }
  return obj;
};
