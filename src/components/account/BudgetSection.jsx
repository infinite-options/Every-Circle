import React, { useEffect, useState } from "react";
import { Box, Typography, Paper, IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";
import { DataGrid } from "@mui/x-data-grid";
import Grid from '@mui/material/Grid2';
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";

const BudgetContainer = styled(Paper)({
  width: "100%",
  marginTop: "10px",
  backgroundColor: "transparent",
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

export function BudgetSection({budgetItems}) {
  const { costs, monthly_caps, current_spend, max_monthly_spend, total_cur_spend} = budgetItems;
  const [isEditing, setIsEditing] = useState(false);
  const [budgetRows, setBudgetRows] = useState([]);

  useEffect(() => {
    setBudgetRows([
      {
        id: 1,
        type: "Per Transactions",
        cost: formatNumber(costs?.per_request || 0),
        monthlyCap: formatNumber(monthly_caps?.request || 0),
        currentSpent: formatNumber(current_spend?.request || 0.0),
      },
      {
        id: 2,
        type: "Per Click",
        cost: formatNumber(costs?.per_click || 0),
        monthlyCap: formatNumber(monthly_caps?.click || 0),
        currentSpent: formatNumber(current_spend?.click || 0.0),
      },
      {
        id: 3,
        type: "Per Impression",
        cost: formatNumber(costs?.per_impression || 0),
        monthlyCap: formatNumber(monthly_caps?.impression || 0),
        currentSpent: formatNumber(current_spend?.impression || 0.0),
      },
    ]);
  }, [budgetItems]);

  const formatNumber = (num) => parseFloat(num).toFixed(2);

  const toggleEditMode = () => setIsEditing((prev) => !prev);

  const handleProcessRowUpdate = (newRow, oldRow) => {
    try {
      const updatedRow = { ...newRow, cost: formatNumber(newRow.cost), monthlyCap: formatNumber(newRow.monthlyCap) };
      setBudgetRows((prevRows) =>
        prevRows.map((row) => (row.id === newRow.id ? updatedRow : row))
      );
      return updatedRow;
    } catch (error) {
      console.error("Error updating row:", error);
      throw error; // Required for MUI X to catch the error
    }
  };

  const handleProcessRowUpdateError = (error) => {
    console.error("Row update failed:", error);
  };

  const columns = [
    { field: "type", headerName: "Type", flex: 1 },
    {
      field: "cost",
      headerName: "Cost",
      flex: 1,
      editable: isEditing,
      valueFormatter: (params) => `$${params}`,
      cellClassName: isEditing ? "editable-cell" : "",
    },
    {
      field: "monthlyCap",
      headerName: "Monthly Cap",
      flex: 1,
      editable: isEditing,
      valueFormatter: (params) => `$${params}`,
      cellClassName: isEditing ? "editable-cell" : "",
    },
    {
      field: "currentSpent",
      headerName: "Current Spent",
      flex: 1,
      valueFormatter: (params) => `$${params}`,
    },
  ];

  return (
    <Box sx={{ width: "100%", marginTop: "10px" }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Budget</Typography>
        <IconButton onClick={toggleEditMode}>
          {isEditing ? <CheckIcon color="success" /> : <EditIcon />}
        </IconButton>
      </Box>

      <BudgetContainer>
        <DataGrid
          rows={budgetRows}
          columns={columns}
          getRowId={(row) => row.id}
          processRowUpdate={handleProcessRowUpdate}
          onProcessRowUpdateError={handleProcessRowUpdateError}
          hideFooter
          sx={{
            border: "none",
            "& .MuiDataGrid-cell": {
              alignItems: "center",
              fontSize: "12px",
              color: "rgba(26, 26, 26, 0.5)",
              fontWeight: 400,
            },
            "& .editable-cell": {
              backgroundColor: "#fff !important",
              color: "black",
            },
            "& .MuiDataGrid-columnHeaderTitle": {
              fontSize: "12px",
              color: "rgba(26, 26, 26, 0.5)",
              fontWeight: 700,
            },
          }}
        />
        <Grid container sx={{ padding: "16px 0px", borderTop: "1px solid #e0e0e0" }}>
          <Grid size={6}>
            <BudgetCell sx={{ fontWeight: 700, width: "100%"}}>Max Monthly Spend:</BudgetCell>
          </Grid>
          <Grid size={3}>
            <BudgetCell>$ {max_monthly_spend ? parseFloat(max_monthly_spend).toFixed(2) : 0.00}</BudgetCell>
          </Grid>
          <Grid size={3}>
            <BudgetCell>$ {total_cur_spend ? parseFloat(total_cur_spend).toFixed(2) : 0.00}</BudgetCell>
          </Grid>
        </Grid>
      </BudgetContainer>
    </Box>
  );
}
