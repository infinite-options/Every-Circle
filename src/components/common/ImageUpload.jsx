import React from "react";
import { Button, Typography, Box } from "@mui/material";

export const ImageUpload = ({ index, onUpload }) => {
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.size <= 2.5 * 1024 * 1024) {
      onUpload?.(file);
    }
  };

  return (
    <Button
      component="label"
      variant="contained"
      sx={{
        width: 120,
        height: 120,
        backgroundColor: "#e0e0e0",
        borderRadius: 2,
        boxShadow: "0px 4px 4px #e0e0e0",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textTransform: "none",
      }}
    >
      <Box>
        <Typography variant="body2" align="center" sx={{color: "#1A1A1A"}}>
          Upload
          <br />
          Image
          <br />
          (png, jpeg)
          <br />
          &lt; 2.5MB
        </Typography>
      </Box>
      <input
        type="file"
        hidden
        accept="image/png,image/jpeg"
        onChange={handleFileChange}
      />
    </Button>
  );
};
