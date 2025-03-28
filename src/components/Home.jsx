//connecting lines 

import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useUserContext } from "./contexts/UserContext";
import "./Home.css";

const Home = () => {
  const location = useLocation();
  const { updateReferralId } = useUserContext();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const referrerId = queryParams.get("referral_id");

    if (referrerId) {
      updateReferralId(referrerId);
    }
  }, [location.search, updateReferralId]);

  return (
    <div className="home-container">
      <h1 className="home-title">It Pays To Be Connected!</h1>

      <div className="circles-container">
        {/* Sign Up Circle */}
        <Link to="/signup?role=user" className="circle signup">
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
          <line className="connector" x1="90" y1="100" x2="280" y2="270" />
          
          {/* Line from Login to Main Circle */}
          <line className="connector" x1="100" y1="500" x2="280" y2="310" />
          
          {/* Line from Main Circle to How It Works */}
          <line className="connector" x1="315" y1="280" x2="315" y2="500" />
        </svg>
      </div>
    </div>
  );
};

export default Home;