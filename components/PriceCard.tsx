interface Props {
  currentPrice: number;
  predictedPrice: number;
  volatility: number;
}

export default function PriceCard({
  currentPrice,
  predictedPrice,
  volatility,
}: Props) {
  const difference = predictedPrice - currentPrice;

  const recommendation =
    difference > 0 ? "HOLD" : "SELL";

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <h2 className="text-2xl font-bold text-green-700 mb-4">
        Market Intelligence
      </h2>

      <p className="text-lg">
        Current Price: <strong>₹ {currentPrice}</strong>
      </p>

      <p className="text-lg mt-2">
        Predicted Price (Next Day):{" "}
        <strong>₹ {predictedPrice.toFixed(2)}</strong>
      </p>

      <p className="mt-2 text-lg">
        Recommendation:{" "}
        <span
          className={`font-bold ${
            recommendation === "HOLD"
              ? "text-green-600"
              : "text-red-600"
          }`}
        >
          {recommendation}
        </span>
      </p>

      <p className="mt-2 text-sm text-gray-500">
        Volatility Index: {volatility.toFixed(2)}
      </p>

      <p className="mt-2 text-sm">
        Expected Gain: ₹ {difference.toFixed(2)}
      </p>
    </div>
  );
}