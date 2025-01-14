import React from "react";
import { TextField } from "@mui/material";

export const HelpItem = ({ text, onChange, backgroundColor, disabled }) => (
  <TextField
    fullWidth
    variant="outlined"
    value={text}
    onChange={(e) => onChange?.(e.target.value)}
    sx={{
      mb: 2,
      backgroundColor: backgroundColor || "#e0e0e0",
      borderRadius: 2,
      "& .MuiOutlinedInput-root": {
        borderRadius: 2,
      },
    }}
    disabled={disabled}
  />
);
