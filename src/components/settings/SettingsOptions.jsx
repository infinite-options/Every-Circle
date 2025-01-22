import React from "react";
import { Box, Typography, Switch, Link } from "@mui/material";
import { useUserContext } from "../contexts/UserContext";

const SettingsOptions = () => {
  const {logout} = useUserContext();
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        maxWidth: "400px",
        mt: '25px',
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", mb: "15px" }}>
        <Typography variant="body1">Allow notifications</Typography>
        <Switch />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", mb: "15px" }}>
        <Typography variant="body1">Dark mode</Typography>
        <Switch />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", mb: "15px" }}>
        <Typography variant="body1">Allow Cookies</Typography>
        <Switch />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: "35px", width: "100%" }}>
        <Link
          href="/privacy-policy"
          underline="always"
          sx={{ color: 'inherit' }}
        >
          Privacy Policy
        </Link>
        <Link
          href="/terms"
          underline="always"
          sx={{ color: 'inherit' }}
        >
          Terms and Conditions
        </Link>
        <Link
          href="/profile"
          underline="always"
          sx={{ color: 'inherit' }}
        >
          Edit User Information
        </Link>
        <Link
          href="/changePassword"
          underline="always"
          sx={{ color: 'inherit' }}
        >
          Change Password
        </Link>
        <Link
          // href="/logout"
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
  );
};

export default SettingsOptions;
