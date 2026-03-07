"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-[#1e1e1e] bg-[#0a0a0a]/98 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-13 py-2">
          {/* Logo — pump.fun style */}
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-[#00ff88] font-black text-lg tracking-tight font-mono">
                artcurve.fun
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-0.5">
              {[
                { href: "/", label: "home" },
                { href: "/explore", label: "explore" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded text-xs transition-colors font-mono ${
                    pathname === href
                      ? "text-[#00ff88]"
                      : "text-[#555] hover:text-[#aaa]"
                  }`}
                >
                  [{label}]
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/create"
              className="px-4 py-1.5 bg-[#00ff88] hover:bg-[#00cc6a] text-black font-bold text-xs rounded font-mono transition-all"
            >
              [launch artwork]
            </Link>
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
          </div>
        </div>
      </div>
    </nav>
  );
}
