"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const crops = ["Wheat", "Rice", "Onion", "Potato"];

export default function CropGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
      {crops.map((crop) => (
        <motion.div
          whileHover={{ scale: 1.05 }}
          key={crop}
        >
          <Link
            href="/commodities"
            className="block bg-white rounded-xl shadow-sm p-6 text-center"
          >
            <div className="text-lg font-semibold">{crop}</div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}