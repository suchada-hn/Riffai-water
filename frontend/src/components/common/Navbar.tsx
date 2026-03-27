"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  TrendingUp,
  AlertTriangle,
  FileText,
  Droplets,
  BarChart3,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: Map },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/predict", label: "Predict", icon: TrendingUp },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/reports", label: "Reports", icon: FileText },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b-2 border-primary-900 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-900 flex items-center justify-center">
              <Droplets className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                version="1.0"
                width="308.000000pt"
                height="218.000000pt"
                viewBox="0 0 308.000000 218.000000"
                preserveAspectRatio="xMidYMid meet"
              >
                <g
                  transform="translate(0.000000,218.000000) scale(0.100000,-0.100000)"
                  fill={"#000000"}
                  stroke="none"
                >
                  <path d="M1793 2035 c21 -52 19 -64 -7 -71 -27 -6 -30 -12 -21 -36 4 -9 17 -13 39 -10 31 4 35 1 41 -27 6 -29 21 -48 31 -39 2 3 -2 21 -10 40 -16 38 -13 48 16 48 13 0 18 7 18 25 0 24 -3 25 -33 20 -31 -6 -34 -4 -43 26 -5 18 -16 35 -23 37 -10 3 -12 0 -8 -13z"></path>
                  <path d="M1450 1851 c-299 -98 -577 -340 -646 -564 l-18 -58 55 -55 54 -54 54 54 c34 34 51 59 47 68 -4 7 -13 24 -21 38 -19 33 -19 111 0 157 60 143 299 328 540 419 85 32 37 29 -65 -5z"></path>
                  <path d="M240 845 l0 -245 50 0 50 0 0 95 0 95 73 0 c46 0 80 -5 92 -14 11 -7 45 -50 75 -95 l55 -81 53 0 c45 0 53 3 48 16 -11 29 -97 143 -126 168 l-30 25 33 10 c83 28 122 128 77 199 -37 60 -81 72 -277 72 l-173 0 0 -245z m345 140 c14 -13 25 -33 25 -45 0 -11 -11 -32 -25 -45 -23 -24 -31 -25 -135 -25 l-110 0 0 70 0 70 110 0 c104 0 112 -1 135 -25z"></path>
                  <path d="M842 848 l3 -243 50 0 50 0 3 243 2 242 -55 0 -55 0 2 -242z"></path>
                  <path d="M1092 848 l3 -243 50 0 50 0 3 103 3 102 140 0 140 0 -3 38 -3 37 -137 3 -138 3 0 59 0 60 145 0 145 0 0 40 0 40 -200 0 -200 0 2 -242z"></path>
                  <path d="M1592 848 l3 -243 48 -3 47 -3 1 90 c1 50 2 97 3 104 1 9 37 13 139 15 l137 3 0 39 0 39 -137 3 -138 3 0 55 0 55 148 3 147 3 0 39 0 40 -200 0 -200 0 2 -242z"></path>
                  <path d="M2163 850 c-73 -131 -133 -242 -133 -245 0 -3 22 -5 49 -5 49 0 49 0 80 55 l31 55 154 0 154 0 28 -55 c29 -55 29 -55 77 -55 26 0 47 5 47 11 0 9 -215 406 -248 457 -11 18 -24 22 -61 22 l-46 0 -132 -240z m236 45 c28 -53 51 -98 51 -100 0 -3 -50 -5 -110 -5 l-110 0 52 100 c29 55 56 100 60 100 3 0 29 -43 57 -95z"></path>
                  <path d="M2742 848 l3 -243 50 0 50 0 3 243 2 242 -55 0 -55 0 2 -242z"></path>
                </g>
              </svg>
              {/* <div className="text-xl font-bold text-primary-900 tracking-tight">
                RIFFAI
              </div>
              <div className="text-[9px] text-primary-600 -mt-1 font-mono tracking-widest">
                PLATFORM
              </div> */}
            </div>
          </div>

          {/* Nav */}
          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-mono text-sm font-medium transition-all ${
                    active
                      ? "bg-primary-900 text-white"
                      : "text-primary-700 hover:bg-primary-100 hover:text-primary-900"
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Right */}
          <div className="flex items-center space-x-3">
            <div className="text-xs text-primary-600 text-right font-mono">
              NIA
            </div>
            <div className="w-8 h-8 bg-primary-900 text-white flex items-center justify-center font-bold text-sm">
              R
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
