import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import SignupForm from "./components/SignupForm";
import LoginForm from "./components/LoginForm";
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/signup' element={<SignupForm />} />
        <Route path='/login' element={<LoginForm />} />
      </Routes>
    </Router>
  );
}

export default App;
