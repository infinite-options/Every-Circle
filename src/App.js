import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import SignupForm from "./components/auth/signup/SignupForm";
import LoginForm from "./components/auth/Login/LoginForm";
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
    <ThemeProvider theme={theme}>
      <Router>
        <Routes>
          <Route exact path='/' element={<Home />} />
          <Route path='/signup' element={<SignupForm />} />
          <Route path='/login' element={<LoginForm />} />
          <Route path='/profileSetup' element={<ProfileSetupForm />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App; 