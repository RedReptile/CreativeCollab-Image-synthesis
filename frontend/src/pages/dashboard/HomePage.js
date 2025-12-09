import React from "react";
import { FaUser, FaArrowRight } from "react-icons/fa";
import { Link } from "react-router-dom";
import HomeImg from "../../images/homeimg.png";
import Card2 from "../../images/card2.jpg";
import Card3 from "../../images/card3.jpg";


const HomePage = () => {
  return (
    <div>
      {/* Header */}
      <header className="text-black px-20 py-10 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold">
          CreativeCollab
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <nav className="space-x-7 flex text-sm font-medium">
            <Link to="/homepage" className="px-4 hover:text-[#4A78EF]">
              Home
            </Link>
            <Link to="/about" className="px-4 hover:text-[#4A78EF]">
              About
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

      {/* Hero Image */}
      <div className="relative w-full flex items-center justify-center px-20 pb-5">
        <img
          src={HomeImg}
          alt="Creative workspace illustration"
          className="w-screen h-auto object-cover relative z-10"
        />
      </div>

      {/* Main Section */}
      <div className="relative flex">
        {/* Left Section */}
        <div className="w-1/2 bg-black pt-20 pb-32 pl-20 pr-8 relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-5xl font-bold leading-tight">
              <span className="font-bold text-[#4A78EF]">TRANSFORM YOUR</span>
              <br />
              <span className="text-white">VISION </span>
              <span className="font-bold text-[#4A78EF]">INTO</span>
              <br />
              <span className="text-white">REALITY</span>
            </h1>
            <p className="text-white text-sm mt-5 font-semibold">
              Presented By @CreativeCollab Platform
            </p>
          </div>

          <div
            className="absolute top-0 right-0 bg-black z-20"
            style={{ clipPath: "polygon(100% 0, 0 0, 0 100%)" }}
          ></div>
        </div>

        {/* Right Section */}
        <div className="w-1/2 flex flex-col justify-center items-center -mt-20">
          {/* Numbers + Text Row */}
          <div className="flex flex-col items-center w-3/4 mb-6">
            <div className="flex items-center justify-center w-full mb-2 ml-4">

              <div className="flex flex-col items-center">
                <span className="font-bold text-lg text-[#4A78EF]">01.</span>
                <span className="text-sm font-semibold text-gray-700 mt-1">
                  Image Synthesis
                </span>
              </div>

              <div className="flex-1 border-t-2 border-black mx-8"></div>

              <div className="flex flex-col items-center">
                <span className="font-bold text-lg text-[#4A78EF]">02.</span>
                <span className="text-sm font-semibold text-gray-700 mt-1">
                  Artistic Filter
                </span>
              </div>
            </div>
          </div>

          {/* Cards Row */}
          <div className="flex justify-between w-3/4 ml-5 gap-8">

            {/* Card 2 */}
            <Link
              to="/imagesynthesis"
              className="relative w-1/3 mx-2 rounded-md overflow-hidden group shadow-lg hover:shadow-2xl transition duration-300"
            >
              <img
                src={Card2}
                alt="AI image synthesis process"
                className="w-full h-[220px] object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/60 transition duration-300"></div>

              {/* Arrow Button */}
              <div className="absolute bottom-3 right-3 bg-white text-black p-2 rounded-full shadow-md hover:bg-[#ffffff] hover:translate-x-0 transition-all">
                <FaArrowRight size={14} />
              </div>
            </Link>

            {/* Card 3 */}
            <Link
              to="/artisticfilter"
              className="relative w-1/3 mx-2 rounded-md overflow-hidden group shadow-lg hover:shadow-2xl transition duration-300"
            >
              <img
                src={Card3}
                alt="Artistic filter transformation"
                className="w-full h-[220px] object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/60 transition duration-300"></div>

              {/* Arrow Button */}
              <div className="absolute bottom-3 right-3 bg-white text-black p-2 rounded-full shadow-md hover:bg-[#ffffff] hover:translate-x-0 transition-all">
                <FaArrowRight size={14} />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
