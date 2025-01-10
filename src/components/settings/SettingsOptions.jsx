import React from "react";
import { Box, Typography, Switch, Link } from "@mui/material";

const SettingsOptions = () => {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
        maxWidth: "400px",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "40px",
        }}
      >
        <Typography variant="body1">Allow notifications</Typography>
        <Typography variant="body1">Dark mode</Typography>
        <Typography variant="body1">Allow Cookies</Typography>
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
          href="/edit-profile"
          underline="always"
          sx={{ color: 'inherit' }}
        >
          Edit User Information
        </Link>
        <Link
          href="/change-password"
          underline="always"
          sx={{ color: 'inherit' }}
        >
          Change Password
        </Link>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <Switch />
        <Switch />
        <Switch />
      </Box>
    </Box>
  );
};

export default SettingsOptions;
