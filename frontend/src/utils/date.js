export const parseLocalDate = (s) => {
  const [y, m, d] = s.split('-');
  return new Date(+y, +m - 1, +d);
};
