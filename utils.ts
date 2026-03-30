
export const isAbortError = (error: any): boolean => {
  if (!error) return false;
  const message = (error.message || String(error)).toLowerCase();
  const name = (error.name || '').toLowerCase();
  const code = (error.code || '').toLowerCase();
  
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
    code === 'cancelled' ||
    code === 'canceled' ||
    code === 'storage/canceled' ||
    code === 'unavailable' ||
    code === 'deadline-exceeded'
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
