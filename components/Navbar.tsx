"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 bg-[#fefce8] backdrop-blur-md border-b border-gray-200"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🌾</span>
          <span className="text-xl font-bold text-green-900 tracking-tight">
            KisanSense
          </span>
        </Link>

        {/* Right Side */}
        <div className="flex items-ce-+nter gap-6">
          
          {/* Optional Navigation Links */}
          <Link
            href="/commodities"
            className="hidden md:block text-gray-600 hover:text-green-700 transition text-sm font-medium"
          >
            Markets
          </Link>

          <Link
            href="/dashboard"
            className="hidden md:block text-gray-600 hover:text-green-700 transition text-sm font-medium"
          >
            Dashboard
          </Link>

          {/* Language Switcher */}
          <LanguageSwitcher />
        </div>
      </div>
    </motion.nav>
  );
}