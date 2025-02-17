import * as React from "react";
import { Box, Typography, } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

export default function NetworkData({ data }) {
  // const [nbRows, setNbRows] = React.useState(3);
  // const removeRow = () => setNbRows((x) => Math.max(0, x - 1));
  // const addRow = () => setNbRows((x) => Math.min(100, x + 1));

  const degreeLabels = {
    0: "You",
    1: "Direct",
    2: "1-Away",
    3: "2-Away"
  };

  const columns = [
    {
      field: "label",
      headerName: "Label",
      flex: 1,
      renderCell: (params) => (
        <Box 
          sx={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            sx={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              backgroundColor: "#ff9500",
              color: "#fff",
              textAlign: "center",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {params.value}
          </Box>
        </Box>
      ),
    },
    { 
      field: "count", 
      headerName: "Count", 
      flex: 1,
      renderCell: (params) => {
        <Box
          sx={{
            width: "100%",
          }}
        >
          {params.value}
        </Box>
      }
     },
  ]

  const rows = data.map((item) => ({
    id: item.id,
    count: item.connection_count,
    label: degreeLabels[item.degree] || "Unknown",
  }));

  return (
    <Box sx={{ width: "100%", minHeight: "300px", marginTop: "16px" }}>
      {data?.length > 0 ? (<DataGrid
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
            textAlign: "center"
          },
        }}
      />) : (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%"
          }}
        >
          No Network
        </Box>
      )}
    </Box>
  );
}
