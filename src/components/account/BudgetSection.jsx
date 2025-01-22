import * as React from "react";
import { Box, Typography, Paper } from "@mui/material";
import { styled } from "@mui/material/styles";
import { DataGrid } from "@mui/x-data-grid";
import Grid from '@mui/material/Grid2';

const BudgetContainer = styled(Paper)({
  width: "100%",
  marginTop: "10px",
  // backgroundColor: "transparent",
});

const BudgetHeader = styled(Box)({
  display: "flex",
  gap: "6px",
  alignItems: "center",
  marginBottom: "16px",
});

const BudgetCell = styled(Typography)({
  fontSize: "12px",
  color: "rgba(26, 26, 26, 0.5)",
  fontWeight: 400,
  lineHeight: 2,
  paddingLeft: "10px",
});

export function BudgetSection() {
  const budgetItems = [
    { id: 1, label: "per Impression", cost: "$0.01", cap: "$10.00", spend: "$ 0.50" },
    { id: 2, label: "per Click", cost: "$0.10", cap: "$10.00", spend: "$ 7.20" },
    { id: 3, label: "per Request", cost: "$1.00", cap: "$10.00", spend: "$ 3.00" },
  ];

  const columns = [
    { field: "label", headerName: "", flex: 1 },
    { field: "cost", headerName: "Cost Per", flex: 1 },
    { field: "cap", headerName: "Monthly Cap", flex: 1 },
    { field: "spend", headerName: "Current Spend", flex: 1 },
  ];

  return (
    <Box sx={{ width: "100%", marginTop: "10px" }}>
      <BudgetHeader>
        <Typography
          variant="h2"
          sx={{
            fontSize: "16px",
            color: "rgba(26, 26, 26, 1)",
            fontWeight: 700,
            letterSpacing: "-0.64px",
            lineHeight: 1,
            margin: 0,
          }}
        >
          Budget
        </Typography>
      </BudgetHeader>
      <BudgetContainer>
        <DataGrid
          rows={budgetItems}
          columns={columns}
          getRowId={(row) => row.id}
          autoSize
          hideFooter
          sx={{
            // border: "none",
            "& .MuiDataGrid-cell": {
              // border: "none",
              alignItems: "center",
              fontSize: "12px",
              color: "rgba(26, 26, 26, 0.5)",
              fontWeight: 400,
            },
            "& .MuiDataGrid-columnHeaderTitle": {
              fontSize: "12px",
              color: "rgba(26, 26, 26, 0.5)",
              fontWeight: 700,
              // border: "none",
              backgroundColor: "transparent",
            },
            // "& .MuiDataGrid-columnHeader": {
            //   backgroundColor: "#f5f5f5",
            // },
          }} />

        <Grid container sx={{ padding: "16px 0px"}}>
          <Grid size={6}>
            <BudgetCell sx={{ fontWeight: 700 }}>Max Monthly Spend:</BudgetCell>
          </Grid>
          <Grid size={3}>
            <BudgetCell>$30.00</BudgetCell>
          </Grid>
          <Grid size={3}>
            <BudgetCell>$30.00</BudgetCell>
          </Grid>
        </Grid>
      </BudgetContainer>
    </Box>
  );
}
