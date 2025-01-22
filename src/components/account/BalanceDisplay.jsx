import * as React from "react";
import { Box, Typography } from "@mui/material";
import Grid from '@mui/material/Grid2';

export function BalanceDisplay({ balance }) {
  return (
    <Grid container spacing={4} sx={{ width: "100%", margin: "10px 0px 10px 0px" }}>
      <Grid size={6}>
        <Box>
          <Typography sx={{ fontWeight: "700", fontSize: "16px" }}>Balance:</Typography>
        </Box>
      </Grid>
      <Grid size={6}>
        <Box>
          <Typography sx={{ fontSize: "16px", textAlign: "right" }}>{balance}</Typography>
        </Box>
      </Grid>
    </Grid>
  );
}
