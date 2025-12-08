import React from "react";
import { FaUser, FaArrowRight } from "react-icons/fa";
import { Link } from "react-router-dom";
const TutorialPage = () => {
  return (
    <div>
      {/* Header */}
      <header className="text-black px-20 py-10 flex items-center justify-between">
        <Link to="/homepage" className="text-lg font-bold">
          CreativeCollab
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <nav className="space-x-7 flex text-sm font-medium">
            <Link to="/homepage" className="px-4 hover:text-[#4A78EF]">
              Home
            </Link>
            <Link to="/services" className="px-4 hover:text-[#4A78EF]">
              Tutorials
            </Link>
          </nav>
        </div>

        <Link
          to="/profile"
          className="px-4 text-sm font-medium hover:text-[#4A78EF] flex items-center gap-2"
        >
          <FaUser className="text-[#4A78EF]" /> Profile
        </Link>
      </header>
    </div>
  );
};

export default TutorialPage;
