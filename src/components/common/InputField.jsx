import React from "react";
import { TextField, Typography, Box, IconButton } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useNavigate } from "react-router-dom";

export const InputField = ({
  label,
  value,
  optional,
  multiline,
  rows,
  onChange,
  width,
  backgroundColor,
  disabled,
}) => {
  const navigate = useNavigate();
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
        <Typography variant="caption" sx={{ ml: 1, mr: 1 }}>
          {label}
        </Typography>
        {label === "Template" && (
          <IconButton size="small" sx={{ p: 0 }} 
          onClick={() => {
            navigate("/selectTemplate");
          }}
          disabled={disabled}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <TextField
        fullWidth
        variant="outlined"
        value={value}
        multiline={multiline}
        rows={rows}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={`${label} ${optional ? "(optional)" : ""}`}
        disabled={disabled}
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
};
