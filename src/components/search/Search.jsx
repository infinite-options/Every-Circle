import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Box, Container, TextField, InputAdornment, Rating, Link, Typography, Button } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import Header from "../common/Header";
import NavigationBar from "../navigation/NavigationBar";
import { BannerAd } from "./BannerAd";
import StyledContainerComponent from "../common/StyledContainer";
import { DataGrid } from '@mui/x-data-grid';
import SectionTitle from "./SectionTitle";
import SearchBar from "../common/SearchBar";
import MultiResult from "./MultiResult";
import axios from "axios";
import dayjs from "dayjs";
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import { useUserContext } from "../contexts/UserContext";

export default function Search() {
  const { user } = useUserContext();
  const profileId = user.profileId;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchString, setSearchString] = useState('');
  const [searchResult, setSearchResult] = useState([]);
  const [showSpinner, setShowSpinner] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if(error){
      setError(null);
    }
  }, [searchString]);

  useEffect(() => {
    //Retrieve data after we navigate back to search page
    console.log('location.state', location.state)

    if (location.state) {
      setShowSpinner(true);
      const { searchResult, searchString } = location.state;
      setSearchResult(searchResult);
      setSearchString(searchString);
      setShowSpinner(false);
    }
  }, [location.state]);

  // Memoize filtered results to avoid recomputing on every render
  const { yourRec, direct, oneAway, twoAway } = useMemo(() => {
    const yourRec = searchResult.filter((data) => data.degree === 0);
    const direct = searchResult.filter((data) => data.degree === 1);
    const oneAway = searchResult.filter((data) => data.degree === 2);
    const twoAway = searchResult.filter((data) => data.degree === 3);
    return { yourRec, direct, oneAway, twoAway };
  }, [searchResult]);


  const handleSearch = async () => {
    if (searchString === "") {
      setSearchResult([]);
      return;
    }
    setShowSpinner(true);
    setError(null);
    try {
      const response = await axios(
        // `https://ioec2testsspm.infiniteoptions.com/search/100-000026?category=${searchString}`
        // `https://ioec2testsspm.infiniteoptions.com/search/${profileId}?type=${searchString}`
        // `https://ioec2testsspm.infiniteoptions.com/search/${profileId}?category=${searchString}`
        `https://ioec2testsspm.infiniteoptions.com/api/v2/search/${profileId}?category=${searchString}`

      );

      // console.log("response", response);
      if (response.status === 200) {
        if(response.data.message === "type not found") {
          setError("No type found. Please search different type.");
          setSearchResult([]);
          return;
        }

        setSearchResult(response.data.result);

      } else {
        setError("Failed to fetch results. Please try again.");
      }
    } catch (error) {
      console.error("Cannot fetch the result:", error);
      setError("Failed to fetch results. Please try again.");
      setSearchResult([]);
    } finally {
      setShowSpinner(false);
    }
  };

  const columns = [
    {
      field: 'rating_updated_at_timestamp',
      headerName: 'Date',
      flex: 1,
      renderCell: (params) => (
        <Typography
          sx={{
            fontSize: "14px",
            color: "rgba(26, 26, 26, 0.8)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {params?.row?.rating_updated_at_timestamp ? dayjs(params.row.rating_updated_at_timestamp).format("MM-DD-YYYY") : "None"}
        </Typography>
      ),
    },
    {
      field: 'rating_profile_id',
      headerName: "Rate By",
      flex: 1,
      renderCell: (params) => (
        <Link
          style={{ cursor: "pointer", textDecoration: "none", fontWeight: "bold", display: "flex", alignItems: "center"}}
          onClick={() => {navigate("/showTemplate", {
            state: {
              data: params.row,
              searchResult: searchResult,
              searchString: searchString,
              navigatingFrom: "profileId",
            }
          })}}
        >
          {params.value}
        </Link>
      ),
    },
    {
      field: 'rating_uid',
      headerName: "Rate Id",
      flex: 1,
      renderCell: (params) => (
        <Typography
          sx={{
            fontSize: "14px",
            color: "rgba(26, 26, 26, 0.8)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: "business_name",
      headerName: "Name",
      flex: 2, // Adjust for more space
      renderCell: (params) => (
        <Box sx={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
          {/* Business Name as a Clickable Link */}
          {/* <Box sx={{height:"50px"}}>
            <Link
              style={{
                border: "1px solid green",
                cursor: "pointer",
                textDecoration: "none",
                color: "#1976d2",
                fontWeight: "bold",
                whiteSpace: "normal", // Allow text to wrap
                width: "100%", // Ensure it takes full width
              }}
              onClick={() =>
                navigate("/showTemplate", {
                  state: {
                    data: params.row,
                    searchResult: searchResult,
                    searchString: searchString,
                    navigatingFrom: "link",
                  },
                })
              }
            >
              {params.value}
            </Link>
          </Box> */}

          <Box sx={{ width: "100%" }}>
            <Typography
              sx={{
                display: "block",
              }}
            >
              <Link style={{
                cursor: "pointer",
                textDecoration: "none",
                color: "#1976d2",
                fontWeight: "bold",
                whiteSpace: "normal",
                width: "100%",
              }}
                onClick={() =>
                  navigate("/showTemplate", {
                    state: {
                      data: params.row,
                      searchResult: searchResult,
                      searchString: searchString,
                      navigatingFrom: "link",
                    },
                  })
                }>
                {params.value}
              </Link>
            </Typography>
          </Box>

          {/* Rating Below the Link */}
          {params.row.rating_description && (
            <Box sx={{ width: "100%" }}>
              <Typography
                sx={{
                  display: "block",
                  fontSize: "0.8rem",
                  color: "#666",
                  whiteSpace: "normal",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  width: "100%",
                  mt: 1,
                }}
              >
                {params.row.rating_description}
              </Typography>
            </Box>
          )}

          {/* Images Below the rating */}
          {params.row.rating_images_url && (
            <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
              {JSON.parse(params.row.rating_images_url).map((imageUrl, index) => (
                <Box
                  key={index}
                  sx={{
                    width: 80, // Fixed width for square box
                    height: 80, // Fixed height for square box
                    borderRadius: 1,
                    overflow: "hidden",
                    border: "1px solid #ddd",
                  }}
                >
                  <img
                    src={imageUrl}
                    alt={`Rating Image ${index + 1}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </Box>
              ))}
            </Box>
          )}
        </Box>
      ),
    },
    {
      field: 'rating_star',
      headerName: 'Rating',
      flex: 1,
      renderCell: (params) => (
        <Link
          style={{ cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => navigate("/showTemplate", {
            state: {
              data: params.row,
              searchResult: searchResult,
              searchString: searchString,
              navigatingFrom: "rating",
            }
          })}
        >
          <Rating value={params.value} readOnly size="small" sx={{ alignContent: "center"}} />
        </Link>
      ),
    },
  ];

  // Reusable DataGrid component
  const renderDataGrid = (rows) => (
    <DataGrid
      rows={rows}
      columns={columns}
      getRowId={(row) => row.rating_uid}
      hideFooter
      // rowHeight={150}
      getRowHeight={() => "auto"}
      localeText={{
        noRowsLabel: "No Recommendations",
      }}
      sx={{
        border: "none",
        "& .MuiDataGrid-cell": {
          border: "none",
          fontSize: "14px",
          color: "rgba(26, 26, 26, 0.8)",
          padding: "8px", // Add padding to cells
        },
        "& .MuiDataGrid-columnHeaders": {
          display: "none",
        },
        minHeight: rows.length === 0 ? "150px" : "auto",
        // Custom scrollbar styles
        "& ::-webkit-scrollbar": {
          width: "6px", // Thin scrollbar width
        },
        "& ::-webkit-scrollbar-track": {
          background: "rgba(0, 0, 0, 0.1)", // Scrollbar track color
          borderRadius: "3px", // Rounded corners for the track
        },
        "& ::-webkit-scrollbar-thumb": {
          background: "rgba(0, 0, 0, 0.3)", // Scrollbar thumb color
          borderRadius: "3px", // Rounded corners for the thumb
          "&:hover": {
            background: "rgba(0, 0, 0, 0.5)", // Darker thumb color on hover
          },
        },
      }}
    />
  );

  return (
    <StyledContainerComponent>
      <Backdrop sx={{ color: '#fff', zIndex: 1 }} open={showSpinner}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <Header title="Search" />
      <Box sx={{
        width: "100%",
        height: "100%",
        padding: "24px",
      }}>
        <SearchBar setSearchString={setSearchString} handleSearch={handleSearch} />
        {error && <p style={{ color: "red" }}>{error}</p>}
        <SectionTitle sx={{ margin: "20px 0px 10px 0px" }}>Your Recommendations</SectionTitle>
        {renderDataGrid(yourRec)}

        <SectionTitle sx={{ margin: "20px 0px 10px 0px" }}>Direct</SectionTitle>
        {renderDataGrid(direct)}

        <SectionTitle sx={{ margin: "20px 0px 0px 0px" }}>1 - Away</SectionTitle>
        {renderDataGrid(oneAway)}

        <SectionTitle sx={{ margin: "20px 0px 0px 0px" }}>2 - Away</SectionTitle>
        {renderDataGrid(twoAway)}

        <BannerAd />
      </Box>
      <NavigationBar />
    </StyledContainerComponent>
  );
}
