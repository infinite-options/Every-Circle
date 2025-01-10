import * as React from "react";
import { Box, Typography } from "@mui/material";

export function BannerAd() {
  return (
    <Box
      sx={{
        bgcolor: "#d9d9d9",
        alignSelf: "center",
        mt: 4.25,
        textAlign: "center",
        py: "11px 26px",
        px: 8.75,
      }}
    >
      <Typography
        sx={{
          color: "#000",
          letterSpacing: "-0.64px",
          fontFamily: "Lexend, sans-serif",
          fontSize: "16px",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        Relevant Banner Ad
      </Typography>
    </Box>
  );
}
