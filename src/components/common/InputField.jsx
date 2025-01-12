import React from "react";
import { TextField, Typography, Box } from "@mui/material";

export const InputField = ({
  label,
  value,
  optional,
  multiline,
  rows,
  onChange,
  width,
  backgroundColor,
}) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="caption" sx={{ ml: 1, mb: 0.5, display: "block" }}>
      {label}
    </Typography>
    <TextField
      fullWidth
      variant="outlined"
      value={value}
      multiline={multiline}
      rows={rows}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={`${label} ${optional ? "(optional)" : ""}`}
      sx={{
        backgroundColor: backgroundColor || "#e0e0e0",
        borderRadius: 2,
        "& .MuiOutlinedInput-root": {
          borderRadius: 2,
        },
        width: width || "100%",
      }}
    />
  </Box>
);
