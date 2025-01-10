import * as React from "react";
import { Box, Typography, Table, TableBody, TableRow, TableCell } from "@mui/material";

export default function NetworkData({ count, label, value }) {
  return (
    <Box sx={{ width: "80%" }}>
    <Table sx={{ width: "100%", margin: "20px 10px 10px 16px" }}>
    <TableBody>
      <TableRow>
        <TableCell sx={{ border: "none", display: "flex", gap: "34px", padding: "0" }}>
          <Typography
            sx={{
              color: "#1a1a1a",
              fontSize: "16px",
              fontWeight: 400,
              lineHeight: 1,
              margin: "auto 0",
            }}
          >
            {count}
          </Typography>
          <Box
            sx={{
              backgroundColor: "#ff9500",
              borderRadius: "50%",
              fontSize: "12px",
              color: "#f5f5f5",
              fontWeight: 500,
              textAlign: "center",
              letterSpacing: "-0.48px",
              lineHeight: "52px",
              width: "52px",
              height: "52px",
              padding: "0 6px",
            }}
          >
            {label}
          </Box>
        </TableCell>
        {/* Second Cell */}
        <TableCell
          sx={{
            border: "none",
            textAlign: "right",
            color: "#1a1a1a",
            fontSize: "16px",
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: "-0.64px",
            padding: "0",
          }}
        >
          {value}
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
  </Box>
  );
}
