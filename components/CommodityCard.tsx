import Link from "next/link";
import { Commodity } from "@/types/commodity";

interface Props {
  commodity: Commodity;
}

export default function CommodityCard({ commodity }: Props) {
  return (
    <Link
      href={`/commodity/${commodity.id}/markets`}
      className="block p-6 bg-white rounded-2xl shadow-md hover:shadow-xl transition duration-300 border border-gray-100 hover:border-green-500"
    >
      <h2 className="text-2xl font-semibold text-green-700">
        {commodity.name}
      </h2>
      <p className="text-sm text-gray-500 mt-2">
        {commodity.category || "Agricultural Commodity"}
      </p>
    </Link>
  );
}