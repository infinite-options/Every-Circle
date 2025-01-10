import React from "react";
import { TextField, Box } from "@mui/material";

export const SocialLink = ({ iconSrc, alt, value, onChange }) => (
  <Box sx={{ display: "flex", gap: 2, mb: 3, alignItems: "center" }}>
    <img
      src={iconSrc}
      alt={alt}
      style={{ width: 48, height: 48, objectFit: "contain" }}
    />
    <TextField
      fullWidth
      variant="outlined"
      placeholder="Enter Link (optional)"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      sx={{
        backgroundColor: "#e0e0e0",
        borderRadius: 2,
        "& .MuiOutlinedInput-root": {
          borderRadius: 2,
        },
      }}
    />
  </Box>
);
