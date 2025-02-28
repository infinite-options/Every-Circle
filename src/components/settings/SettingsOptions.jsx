import React from "react";
import { Box, Typography, Switch, Link } from "@mui/material";
import { useUserContext } from "../contexts/UserContext";
import { useNavigate } from "react-router-dom";

const SettingsOptions = () => {
  const { logout } = useUserContext();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        maxWidth: "400px",
        mt: "25px",
      }}
    >
      {/* Notification Toggle */}
      <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", mb: "15px" }}>
        <Typography variant="body1">Allow notifications</Typography>
        <Switch />
      </Box>

      {/* Dark Mode Toggle */}
      <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", mb: "15px" }}>
        <Typography variant="body1">Dark mode</Typography>
        <Switch />
      </Box>

      {/* Allow Cookies Toggle */}
      <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", mb: "25px" }}>
        <Typography variant="body1">Allow Cookies</Typography>
        <Switch />
      </Box>

      {/* Links Section - Aligned Properly with More Spacing */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: "30px", width: "100%" }}>
        <Box sx={{ display: "flex", justifyContent: "flex-start", width: "100%" }}>
          <Link
            component="button"
            underline="always"
            sx={{ color: 'inherit', cursor: 'pointer' }}
            onClick={() => navigate("/privacy-policy")}
          >
            Privacy Policy
          </Link>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "flex-start", width: "100%" }}>
          <Link
            component="button"
            underline="always"
            sx={{ color: 'inherit', cursor: 'pointer' }}
            onClick={() => navigate("/terms")}
          >
            Terms and Conditions
          </Link>
        </Box>

        

        <Box sx={{ display: "flex", justifyContent: "flex-start", width: "100%" }}>
          <Link href="/profile" underline="always" sx={{ color: 'inherit' }}>
            Edit User Information
          </Link>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "flex-start", width: "100%" }}>
          <Link href="/changePassword" underline="always" sx={{ color: 'inherit' }}>
            Change Password
          </Link>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "flex-start", width: "100%" }}>
          <Link
            underline="always"
            sx={{ color: 'inherit', cursor: 'pointer' }}
            onClick={() => {
              logout();
            }}
          >
            Logout
          </Link>
        </Box>
      </Box>
    </Box>
  );
};

export default SettingsOptions;
