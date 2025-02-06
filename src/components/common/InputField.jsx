import React from "react";
import { 
  TextField, 
  Typography, 
  Box, 
  IconButton, 
  Select,
  MenuItem,
  FormControl,
  InputLabel, } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useNavigate } from "react-router-dom";

// export const InputField = ({
//   label,
//   value,
//   optional,
//   multiline,
//   rows,
//   onChange,
//   width,
//   backgroundColor,
//   disabled,
//   required,
//   error,
//   helperText,
// }) => {
//   const navigate = useNavigate();
//   return (
//     <Box sx={{ mb: 3 }}>
//       <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
//         <Typography variant="caption" sx={{ ml: 1, mr: 1 }}>
//         {label} {required && <span style={{ color: "red" }}>*</span>}
//         </Typography>
//       </Box>
//       <TextField
//         fullWidth
//         variant="outlined"
//         value={value}
//         multiline={multiline}
//         rows={rows}
//         onChange={(e) => onChange?.(e.target.value)}
//         placeholder={`${label} ${optional ? "(optional)" : ""}`}
//         disabled={disabled}
//         required={required}
//         error={error}
//         helperText={helperText}
//         sx={{
//           backgroundColor: backgroundColor || "#e0e0e0",
//           borderRadius: 2,
//           "& .MuiOutlinedInput-root": {
//             borderRadius: 2,
//           },
//           width: width || "100%",
//         }}
//       />
//     </Box>
//   );
// };

export const InputField = ({
  label,
  value,
  onChange,
  optional,
  required,
  error,
  helperText,
  multiline,
  rows,
  width,
  backgroundColor,
  disabled,
  options, // If provided, renders a dropdown instead of a text field
}) => {
  // console.log("InputField -> options", value);
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
        <Typography variant="caption" sx={{ ml: 1, mr: 1 }}>
          {label} {required && <span style={{ color: "red" }}>*</span>}
        </Typography>
      </Box>

      {/* Dropdown if options are provided */}
      {options ? (
        <FormControl fullWidth error={!!error} disabled={disabled}>
          <Select
            value={value} 
            onChange={(e) => onChange?.(e.target.value)}
            displayEmpty
            sx={{
              backgroundColor: backgroundColor || "#e0e0e0",
              borderRadius: 2,
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
              },
              width: width || "100%",
            }}
          >
            <MenuItem value="">Select a Category</MenuItem>

            {options.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : (
        // TextField if no options provided
        <TextField
          fullWidth
          variant="outlined"
          value={value}
          multiline={multiline}
          rows={rows}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={`${label} ${optional ? "(optional)" : ""}`}
          disabled={disabled}
          required={required}
          error={error}
          helperText={helperText}
          sx={{
            backgroundColor: backgroundColor || "#e0e0e0",
            borderRadius: 2,
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
            },
            width: width || "100%",
          }}
        />
      )}
    </Box>
  );
};

