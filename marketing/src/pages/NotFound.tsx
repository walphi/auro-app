import React from "react";
import { Link } from "react-router-dom";
import { Seo } from "../components/Seo.tsx";

export default function NotFound() {
  return (
    <>
      <Seo
        metaTitle="Page Not Found"
        metaDescription="The page you are looking for does not exist."
        robots="noindex, follow"
      />

      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6 text-center">
        <span className="text-[9px] font-mono tracking-[0.4em] text-[#D4FF00] uppercase">404</span>
        <h1 className="font-serif text-3xl text-[#f4f4f4] font-light">
          Page Not Found
        </h1>
        <p className="text-sm text-neutral-300 font-light max-w-md">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex gap-4">
          <Link
            to="/"
            className="px-5 py-2 bg-[#D4FF00] text-black border border-[#D4FF00] hover:bg-transparent hover:text-[#D4FF00] text-[10px] font-mono uppercase tracking-widest font-bold transition-colors"
          >
            Back Home
          </Link>
          <Link
            to="/insights"
            className="px-5 py-2 border border-[#333] text-neutral-400 hover:text-[#D4FF00] hover:border-[#D4FF00] text-[10px] font-mono uppercase tracking-widest transition-colors"
          >
            Browse Insights
          </Link>
        </div>
      </div>
    </>
  );
}
