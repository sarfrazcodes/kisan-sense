"use client";

import { motion } from "framer-motion";

export default function PreviewCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      className="bg-white shadow rounded-xl p-6 max-w-md mx-auto mt-10"
    >
      <h3 className="font-bold text-lg mb-2">Wheat – Jaipur</h3>
      <p>Today: ₹2300</p>
      <p>Predicted: ₹2420</p>
      <p className="text-green-600 font-semibold">
        Recommendation: HOLD
      </p>
    </motion.div>
  );
}