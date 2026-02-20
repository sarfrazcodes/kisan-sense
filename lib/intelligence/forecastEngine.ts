export function calculateMovingAverage(prices: number[]) {
  return prices.reduce((a, b) => a + b, 0) / prices.length;
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

  return intercept + slope * n;
}

export function generateRecommendation(
  currentPrice: number,
  predictedPrice: number,
  volatility: number
) {
  const difference = predictedPrice - currentPrice;

  if (difference > 0 && volatility < 200) {
    return {
      action: "HOLD",
      expectedGain: difference,
      risk: "LOW",
    };
  }

  return {
    action: "SELL",
    expectedGain: difference,
    risk: volatility > 300 ? "HIGH" : "MEDIUM",
  };
}