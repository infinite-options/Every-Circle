import * as React from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Box, Typography, Paper } from "@mui/material";
import { styled } from "@mui/material/styles";

const TransactionSection = styled(Box)({
  width: "100%",
  marginTop: "40px",
});

const TransactionHeader = styled(Box)({
  display: "flex",
  gap: "5px",
  alignItems: "center",
  marginBottom: "20px",
});

const columns = [
  { field: "date", headerName: "Date", width: 100 },
  { field: "name", headerName: "Description", width: 200, flex: 1 },
  {
    field: "amount",
    headerName: "Amount",
    width: 100,
    align: "right",
    headerAlign: "right",
  },
];

export function TransactionList({ transactions }) {
  return (
    <TransactionSection>
      <TransactionHeader>
        <Typography
          variant="h2"
          sx={{
            fontSize: "16px",
            color: "rgba(26, 26, 26, 1)",
            fontWeight: 700,
            lineHeight: 1,
            margin: 0,
          }}
        >
          Transaction History
        </Typography>
      </TransactionHeader>
      <Paper>
      <DataGrid
        rows={transactions}
        columns={columns}
        autoHeight
        hideFooter
        sx={{
          border: "none",
          "& .MuiDataGrid-cell": {
            border: "none",
            fontSize: "12px",
            color: "rgba(26, 26, 26, 0.5)",
            fontWeight: 400,
            lineHeight: 2,
          },
          "& .MuiDataGrid-columnHeaders": {
            display: "none",
          },
        }}
      />
      </Paper>
    </TransactionSection>
  );
}
