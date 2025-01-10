import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import SignupForm from "./components/SignupForm";
import LoginForm from "./components/LoginForm";
import Profile from "./components/profile/Profile";
import Settings from "./components/settings/Settings";
import AccountDashboard from "./components/account/AccountDashboard";
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        {/* <Route path='/signup' element={<SignupForm />} />
        <Route path='/login' element={<LoginForm />} /> */}
                <Route path='/' element={<Profile />} />
                <Route path = "/settings" element={<Settings />} />
                <Route path = "/account" element={<AccountDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
