import Link from "next/link";

interface Props {
  mandiId: string;
  mandiName: string;
  state: string | null;
  price: number | null;
  trend: "up" | "down" | "flat";
  commodityId: string;
}

export default function MandiCard({
  mandiId,
  mandiName,
  state,
  price,
  trend,
  commodityId,
}: Props) {
  return (
    <Link
      href={`/dashboard/${commodityId}/${mandiId}`}
      className="block bg-white p-6 rounded-xl shadow hover:shadow-lg transition border hover:border-green-500"
    >
      <h2 className="text-xl font-semibold text-green-700">
        {mandiName}
      </h2>
      <p className="text-sm text-gray-500">{state}</p>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-lg font-bold">
          ₹ {price ?? "N/A"}
        </span>

        <span className="text-xl">
          {trend === "up" && "📈"}
          {trend === "down" && "📉"}
          {trend === "flat" && "➖"}
        </span>
      </div>
    </Link>
  );
}