import React from "react";
import { Link } from "react-router-dom";
import "./Home.css";

const Home = () => {
  return (
    <div className='home-container'>
      <h1 className='home-title'>It Pays To Be Connected!</h1>

      <div className='circles-container'>
        {/* Sign Up Circle */}
        <Link to='/signup' className='circle signup'>
          <span>Sign Up</span>
        </Link>

        {/* Main Circle */}
        <div className='circle main'>
          <span>Every</span>
          <span>Circle</span>
        </div>

        {/* Login Circle */}
        <Link to='/login' className='circle login'>
          <span>Login</span>
        </Link>

        {/* How It Works Circle */}
        <div className='circle how-it-works'>
          <span>How It</span>
          <span>Works</span>
        </div>

        {/* SVG for connecting lines */}
        <svg className='connecting-lines' width='100%' height='100%' viewBox='0 0 100 100' preserveAspectRatio='none'>
          {/* Line from Sign Up to Main Circle */}
          <line className='connector' x1='30' y1='30' x2='50' y2='50' />
          {/* Line from Login to Main Circle */}
          <line className='connector' x1='30' y1='70' x2='50' y2='50' />
          {/* Line from Main Circle to How It Works */}
          <line className='connector' x1='50' y1='50' x2='70' y2='70' />
        </svg>
      </div>
    </div>
  );
};

export default Home;
