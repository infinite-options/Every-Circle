import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./Home.css";
import { useLocation } from "react-router-dom";
import { useUserContext } from "./contexts/UserContext";

const Home = () => {
  const location = useLocation();
  const { updateReferralId } = useUserContext();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const referrerId = queryParams.get("referral_id");

    if (referrerId) {
      // console.log("Setting referral ID:", referrerId);
      updateReferralId(referrerId);
    }
  }, [location.search]);

  return (
    <div className="home-container">
      <h1 className="home-title">It Pays To Be Connected!</h1>

      <div className="circles-container">
        {/* Sign Up Circle */}
        <Link to="/signup" className="circle signup">
          <span>Sign Up</span>
        </Link>

        {/* Main Circle */}
        <div className="circle main">
          <span>Every</span>
          <span>Circle</span>
        </div>

        {/* Login Circle */}
        <Link to="/login" className="circle login">
          <span>Login</span>
        </Link>

        {/* How It Works Circle */}
        <div className="circle how-it-works">
          <span>How It</span>
          <span>Works</span>
        </div>

        {/* SVG for connecting lines */}
        <svg
          className="connecting-lines"
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        >
          {/* Line from Sign Up to Main Circle */}
          <line className="connector" x1="25%" y1="20%" x2="45%" y2="45%" />
          {/* Line from Login to Main Circle */}
          <line className="connector" x1="25%" y1="65%" x2="45%" y2="55%" />
          {/* Line from Main Circle to How It Works */}
          <line className="connector" x1="55%" y1="50%" x2="75%" y2="65%" />
        </svg>
      </div>
    </div>
  );
};

export default Home;
