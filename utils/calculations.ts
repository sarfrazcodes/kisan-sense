export function calculateMovingAverage(prices: number[]) {
  const sum = prices.reduce((a, b) => a + b, 0);
  return sum / prices.length;
}

export function calculateVolatility(prices: number[]) {
  const mean = calculateMovingAverage(prices);
  const variance =
    prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) /
    prices.length;
  return Math.sqrt(variance);
}

export function linearRegressionForecast(prices: number[]) {
  const n = prices.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = prices;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);

  const slope =
    (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  const intercept = (sumY - slope * sumX) / n;

  const nextValue = intercept + slope * n;

  return nextValue;
}