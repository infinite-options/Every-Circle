import * as React from "react";
import { Box, Container, TextField, InputAdornment, Rating } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import Header from "../common/Header";
import NavigationBar from "../navigation/NavigationBar";
import { BannerAd } from "./BannerAd";
import StyledContainerComponent from "../common/StyledContainer";
import { DataGrid } from '@mui/x-data-grid';
import SectionTitle from "./SectionTitle";

const data = [
  {
    id: 1,
    date: "1/10",
    name: "ABC Plumbing",
    rating: 4,
  },
  {
    id: 2,
    date: "1/23",
    name: "Hector Handyman",
    rating: 3,
  },
  {
    id: 3,
    date: "1/17",
    name: "Fast Rooter",
    rating: 2,
  },
];

const directData = [
  {
    id: 1,
    date: "1/30",
    name: "Speedy Roto",
    rating: 4,
  },
];

const columns = [
  { field: 'date', headerName: 'Date', width: 100 },
  { field: 'name', headerName: 'Name', flex: 150 },
  {
    field: 'rating',
    headerName: 'Rating',
    width: 150,
    renderCell: (params) => (
      <Rating
        value={params.value}
        readOnly
        size="small"
      />
    ),
  },
];


export default function Search() {
  return (
    <StyledContainerComponent>
      <Header title="Search" />
      <Box sx={{
        // backgroundColor: "yellow",
        width: "100%",
        padding: "20px",
      }}>
        <Box sx={{ alignItems: "center", justifyContent: "center", margin: "0px 0px 20px 0px" }}>
          
          <TextField
            variant="outlined"
            fullWidth
            placeholder="Search..."
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
        <SectionTitle>Your Recommendations</SectionTitle>
        <DataGrid
          rows={data}
          columns={columns}
          hideFooter
          autoHeight
          sx={{
            border: 'none',
            '& .MuiDataGrid-cell': {
              border: 'none',
              fontSize: '14px',
              color: 'rgba(26, 26, 26, 0.8)',
            },
            "& .MuiDataGrid-columnHeaders": {
              display: "none",
            },
          }}
        />

        <SectionTitle>Direct</SectionTitle>
        <DataGrid
          rows={directData}
          columns={columns}
          hideFooter
          autoHeight
          sx={{
            border: 'none',
            '& .MuiDataGrid-cell': {
              border: 'none',
              fontSize: '14px',
              color: 'rgba(26, 26, 26, 0.8)',
            },
            "& .MuiDataGrid-columnHeaders": {
              display: "none",
            },
          }}
        />
        <SectionTitle sx={{ mt: 5 }}>1 - Away</SectionTitle>
        <SectionTitle sx={{ mt: 5 }}>2 - Away</SectionTitle>
      </Box>
      <BannerAd />
      <NavigationBar />
    </StyledContainerComponent>
  );
}
