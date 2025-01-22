import * as React from "react";
import { Box, Typography, } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

export default function NetworkData({ data }) {
  const [nbRows, setNbRows] = React.useState(3);
  const removeRow = () => setNbRows((x) => Math.max(0, x - 1));
  const addRow = () => setNbRows((x) => Math.min(100, x + 1));

  const columns = [
    { field: "count", headerName: "Count", flex: 1 },
    {
      field: "label",
      headerName: "Label",
      flex: 1,
      renderCell: (params) => (
        <Box
          sx={{
            width: 50,
            height: 50,
            borderRadius: "50%",
            backgroundColor: "#ff9500",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {params.value}
        </Box>
      ),
    },
    { field: "value", headerName: "Value", flex: 1 },
  ]

  const rows = data.map((item) => ({
    id: item.id,
    count: item.count,
    label: item.label,
    value: item.value,
  }));

  return (
    <Box sx={{ width: "100%", minHeight: "300px", marginTop: "16px" }}>
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        hideFooter
        autoHeight
        sx={{
          flexGrow: 1,
          "& .MuiDataGrid-columnHeaders": {
            display: "none",
          },
          "& .MuiDataGrid-cell": {
            alignItems: "center",
            // border: "none",
          },
        }}
      />
    </Box>
  );
}
