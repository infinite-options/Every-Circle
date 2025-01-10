import * as React from "react";
import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

const BalanceSection = styled(Box)({
  alignSelf: "flex-start",
  display: "flex",
  width: "100%",
  maxWidth: "300px",
  gap: "20px",
  justifyContent: "space-between",
});

const BalanceLabel = styled(Typography)({
  fontSize: "16px",
  color: "rgba(26, 26, 26, 1)",
  fontWeight: 700,
});

const BalanceAmount = styled(Typography)({
  fontSize: "16px",
  color: "rgba(26, 26, 26, 1)",
  fontWeight: 400,
  textAlign: "right",
});

export function BalanceDisplay({ balance }) {
  return (
    <BalanceSection>
      <BalanceLabel>Balance:</BalanceLabel>
      <BalanceAmount>{balance}</BalanceAmount>
    </BalanceSection>
  );
}
