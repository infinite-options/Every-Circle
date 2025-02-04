import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import SignupForm from "./components/auth/signup/SignupForm";
import LoginForm from "./components/auth/Login/LoginForm";
import { ThemeProvider, createTheme } from '@mui/material';
import ProfileSetupForm from './components/ProfileSetup/ProfileSetupForm';
import Profile from "./components/profile/Profile";
import Settings from "./components/settings/Settings";
import AccountDashboard from "./components/account/AccountDashboard";
import Network from "./components/network/Network";
import Search from "./components/search/Search";
import ReferralForm from "./components/referral/ReferralForm";
import ChangePassword from "./components/settings/password/ChangePassword";
import ShowTemplate from "./components/showTemplate/ShowTemplate";
import SelectTemplate from "./components/SelectTemplate/SelectTemplate";
import MultiResult from "./components/search/MultiResult";
import RecommendationForm from "./components/recommendation/RecommendationForm";
import BusinessProfileSetupForm from "./components/ProfileSetup/BusinessProfileSetupForm";
import BusinessProfile from "./components/BusinessProfile/BusinessProfile";

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
          <Route path='/businessProfileSetup' element={<BusinessProfileSetupForm />} />
          <Route path='/profile' element={<Profile />} />
          <Route path='/businessProfile' element={<BusinessProfile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/account" element={<AccountDashboard />} />
          <Route path="/network" element={<Network />} />
          <Route path="/search" element={<Search />} />
          <Route path="/referral" element={<ReferralForm />} />
          <Route path="/changePassword" element={<ChangePassword />} />
          <Route path="/showTemplate" element={<ShowTemplate />} />
          <Route path="/multiResult" element={<MultiResult />} />
          <Route path="/selectTemplate" element={<SelectTemplate />} />
          <Route path="/recommendation" element={<RecommendationForm/>} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App; 