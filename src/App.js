import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import SignupForm from "./components/SignupForm";
import LoginForm from "./components/LoginForm";
import "./App.css";
import { ThemeProvider, createTheme } from '@mui/material';
import ProfileSetupForm from './components/ProfileSetup/ProfileSetupForm';

const theme = createTheme({
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '8px',
          padding: '12px',
        },
      },
    },
  },
});

function App() {
  return (
    <Router>
      <Routes>
        <Route exact path='/' element={<Home />} />
        <Route path='/signup' element={<SignupForm />} />
        <Route path='/login' element={<LoginForm />} />
        <Route path='/profile-setup' element={<ProfileSetupForm />} />
      </Routes>
    </Router>
  );
}

export default App; 