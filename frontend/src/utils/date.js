export const parseLocalDate = (s) => {
  if (typeof s !== 'string' || !s) {
    return new Date(NaN);
  }

  const parts = s.split('-');
  if (parts.length !== 3) {
    return new Date(NaN);
  }

  const [yStr, mStr, dStr] = parts;
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);

  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
    return new Date(NaN);
  }

  return new Date(y, m - 1, d);
};
