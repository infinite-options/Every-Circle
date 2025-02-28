import React from "react";
import { useNavigate, useLocation } from "react-router-dom"; // Import useLocation
import { Box, IconButton, styled } from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ShareIcon from "@mui/icons-material/Share";
import SettingsIcon from "@mui/icons-material/Settings";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { useUserContext } from "../contexts/UserContext";

const StyledIconButton = styled(IconButton)({
  width: "60px",
  height: "60px",
});

// Define the color from your UI
const activeColor = "#a044ff"; // Purple gradient color

const NavigationBar = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Get current route
  const { user } = useUserContext();

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
        marginTop: "auto",
      }}
    >
      {/* Profile Button */}
      <StyledIconButton
        aria-label="home"
        onClick={() => {
          if (user.role === "business") {
            navigate("/businessProfile");
          } else {
            navigate("/profile");
          }
        }}
      >
        <AccountCircleIcon
          sx={{
            width: "30px",
            height: "30px",
            color: location.pathname === "/profile" || location.pathname === "/businessProfile" ? activeColor : "gray",
          }}
        />
      </StyledIconButton>

      {/* Settings Button */}
      <StyledIconButton aria-label="settings" onClick={() => navigate("/settings")}>
        <SettingsIcon
          sx={{
            width: "30px",
            height: "30px",
            color: location.pathname === "/settings" ? activeColor : "gray",
          }}
        />
      </StyledIconButton>

      {/* Account Button */}
      <StyledIconButton aria-label="account" onClick={() => navigate("/account")}>
        <AccountBalanceIcon
          sx={{
            width: "30px",
            height: "30px",
            color: location.pathname === "/account" ? activeColor : "gray",
          }}
        />
      </StyledIconButton>

      {/* Network Button */}
      <StyledIconButton aria-label="network" onClick={() => navigate("/network")}>
        <ShareIcon
          sx={{
            width: "30px",
            height: "30px",
            color: location.pathname === "/network" ? activeColor : "gray",
          }}
        />
      </StyledIconButton>

      {/* Search Button */}
      <StyledIconButton aria-label="search" onClick={() => navigate("/search")}>
        <SearchOutlinedIcon
          sx={{
            width: "30px",
            height: "30px",
            color: location.pathname === "/search" ? activeColor : "gray",
          }}
        />
      </StyledIconButton>
    </Box>
  );
};

export default NavigationBar;
