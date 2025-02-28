// import React, { useState, useEffect } from "react";
// import Header from "../common/Header";
// import NavigationBar from "../navigation/NavigationBar";
// import StyledContainer from "../common/StyledContainer";
// import NetworkData from "./NetworkData";
// import SearchBar from "../common/SearchBar";
// import { Box, Typography, styled, IconButton } from "@mui/material";
// import GroupAddIcon from '@mui/icons-material/GroupAdd';
// import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
// import { useNavigate } from "react-router-dom";
// import { useUserContext } from "../contexts/UserContext";
// import axios from "axios";
// import APIConfig from "../../APIConfig";

// const TotalLabel = styled(Typography)({
//     color: "#1a1a1a",
//     fontSize: "16px",
//     fontWeight: 700,
//     lineHeight: 1,
//     marginTop: "11px",
// });

// export default function Network() {
//     const navigate = useNavigate();
//     const [data, setData] = useState([]);

//     const { user, updateUser } = useUserContext();

//     useEffect(()=>{
//         const fetchNetworkData = async () => {
//             try {
//                 const response = await axios.get(`${APIConfig.baseURL.dev}/api/v1/connections/${user.profileId}`);

//                 console.log(response.data.result)
//                 setData(response.data.result.map((item, index) => ({
//                     id: index + 1,  
//                     ...item         
//                 })));
                

//                 // setMainCategories(mainCategories);
//             } catch (error) {
//                 console.error("Error fetching categories:", error);
//             }
//         };

//         if(user.role === "user"){
//             fetchNetworkData();
//         }
//     }, [])

//     return (
//         <StyledContainer>
//             <Header title="Network" />
//             <Box sx={{ width: "100%", padding: "0px 16px 16px 16px" }}>
//                 <Box sx={{ width: "100%", paddingX: "16px", display: "flex", justifyContent: "space-between" }}>
//                     <IconButton onClick={() => navigate("/referral")}>
//                         <GroupAddIcon />
//                     </IconButton>

//                     <IconButton onClick={() => navigate("/recommendation")}>
//                         <AddShoppingCartIcon />
//                     </IconButton>
//                 </Box>
//                 <SearchBar />

//                 <Box sx={{ alignSelf: "flex-start", width: "100%", marginTop: "24px" }}>
//                     <TotalLabel>Total</TotalLabel>
//                 </Box>
//                 <NetworkData data={data} />
//             </Box>
//             <NavigationBar />
//         </StyledContainer>
//     );
// }

import React, { useState, useEffect, useMemo } from "react";
import Header from "../common/Header";
import NavigationBar from "../navigation/NavigationBar";
import StyledContainer from "../common/StyledContainer";
import NetworkData from "./NetworkData";
import SearchBar from "../common/SearchBar";
import { Box, Typography, styled, IconButton, CircularProgress, Grid } from "@mui/material";
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../contexts/UserContext";
import axios from "axios";
import APIConfig from "../../APIConfig";
import Backdrop from '@mui/material/Backdrop';

const TotalLabel = styled(Typography)({
    color: "#1a1a1a",
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1,
    marginTop: "11px",
});

export default function Network() {
    const navigate = useNavigate();
    const [networkData, setNetworkData] = useState([]);
    const [searchString, setSearchString] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [showSpinner, setShowSpinner] = useState(false);
    const [error, setError] = useState(null);

    const { user } = useUserContext();

    useEffect(() => {
        if(error){
            setError(null);
        }
    }, [searchString]);

    useEffect(() => {
        const fetchNetworkData = async () => {
            try {
                const response = await axios.get(`${APIConfig.baseURL.dev}/api/v1/connections/${user.profileId}`);
                console.log("Network data:", response.data.result);
                setNetworkData(response.data.result.map((item, index) => ({
                    id: index + 1,  
                    ...item         
                })));
            } catch (error) {
                console.error("Error fetching network data:", error);
            }
        };

        if(user.role === "user"){
            fetchNetworkData();
        }
    }, [user]);

    const handleSearch = async () => {
        if (searchString === "") {
            setSearchResults(null);
            return;
        }
        
        setShowSpinner(true);
        setError(null);
        
        try {
            // Call the v3 API endpoint
            const apiUrl = `https://ioec2testsspm.infiniteoptions.com/api/v3/AITagSearch/${user.profileId}?query=${searchString}`;
            const response = await axios(apiUrl);
            
            console.log("Search API response:", response);
            
            if (response.status === 200) {
                if(response.data.message === "type not found") {
                    setError("No type found. Please search different type.");
                    setSearchResults(null);
                    return;
                }
                
                // Process the response
                if (response.data.business_results) {
                    if (response.data.business_results.businesses) {
                        // v2 API response
                        processV2SearchResults(response.data.business_results.businesses);
                    } else if (response.data.business_results.strict_matches || response.data.business_results.loose_matches) {
                        // v3 API response
                        processV3SearchResults(response.data);
                    } else {
                        console.error("Unexpected response format:", response.data);
                        setError("Unexpected response format from server.");
                    }
                } else {
                    setError("No results found.");
                    setSearchResults(null);
                }
            } else {
                setError("Failed to fetch results. Please try again.");
            }
        } catch (error) {
            console.error("Cannot fetch search results:", error);
            setError("Failed to fetch results. Please try again.");
            setSearchResults(null);
        } finally {
            setShowSpinner(false);
        }
    };

    // Process v2 API response
    const processV2SearchResults = (businesses) => {
        // Group by connection degree
        const groupedData = businesses.reduce((acc, business) => {
            const degree = business.connection_degree || 0;
            
            if (!acc[degree]) {
                acc[degree] = {
                    degree,
                    businesses: [],
                    total_ratings: 0
                };
            }
            
            acc[degree].businesses.push(business);
            acc[degree].total_ratings++;
            
            return acc;
        }, {});
        
        // Convert to array format
        const resultsByDegree = Object.values(groupedData);
        setSearchResults(resultsByDegree);
    };

    // Process v3 API response
    const processV3SearchResults = (data) => {
        const processedResults = [];
        
        // Function to process businesses into connection degree groups
        const processBusinesses = (businesses, defaultDegree) => {
            if (!businesses || !Array.isArray(businesses)) return;
            
            businesses.forEach(business => {
                if (business.ratings && business.ratings.length > 0) {
                    // Group ratings by connection degree
                    business.ratings.forEach(rating => {
                        const degree = rating.connection_degree !== undefined ? 
                                      rating.connection_degree : defaultDegree;
                        
                        // Find or create the degree group
                        let degreeGroup = processedResults.find(group => group.degree === degree);
                        if (!degreeGroup) {
                            degreeGroup = { 
                                degree, 
                                businesses: [], 
                                total_ratings: 0,
                                user_ids: new Set()
                            };
                            processedResults.push(degreeGroup);
                        }
                        
                        // Add business and rating info
                        const businessWithRating = {
                            ...business,
                            ...rating,
                            connection_degree: degree
                        };
                        
                        degreeGroup.businesses.push(businessWithRating);
                        degreeGroup.total_ratings++;
                        if (rating.profile_first_name) {
                            degreeGroup.user_ids.add(rating.rating_profile_id);
                        }
                    });
                } else {
                    // Business without ratings
                    const degree = defaultDegree;
                    
                    // Find or create the degree group
                    let degreeGroup = processedResults.find(group => group.degree === degree);
                    if (!degreeGroup) {
                        degreeGroup = { 
                            degree, 
                            businesses: [], 
                            total_ratings: 0,
                            user_ids: new Set()
                        };
                        processedResults.push(degreeGroup);
                    }
                    
                    degreeGroup.businesses.push({
                        ...business,
                        connection_degree: degree
                    });
                    degreeGroup.total_ratings++;
                }
            });
        };
        
        // Process strict matches as degree 1, loose matches as degree 2
        if (data.business_results.strict_matches) {
            processBusinesses(data.business_results.strict_matches, 1);
        }
        
        if (data.business_results.loose_matches) {
            processBusinesses(data.business_results.loose_matches, 2);
        }
        
        // Convert Set objects to size numbers
        processedResults.forEach(group => {
            group.connection_count = group.user_ids ? group.user_ids.size : 0;
            delete group.user_ids;
        });
        
        // Sort by degree
        processedResults.sort((a, b) => a.degree - b.degree);
        console.log("Processed search results:", processedResults);
        
        setSearchResults(processedResults);
    };

    // Combine network data with search results for display
    const combinedData = useMemo(() => {
        if (!searchResults) {
            return networkData;
        }
        
        // Create a map of the existing network data
        const networkMap = new Map();
        networkData.forEach(item => {
            networkMap.set(item.degree, item);
        });
        
        // Update with search results
        searchResults.forEach(result => {
            if (networkMap.has(result.degree)) {
                // Update existing degree entry
                const networkItem = networkMap.get(result.degree);
                networkMap.set(result.degree, {
                    ...networkItem,
                    search_results: result.businesses,
                    search_total: result.total_ratings
                });
            } else {
                // Create new degree entry
                networkMap.set(result.degree, {
                    degree: result.degree,
                    connection_count: 0,
                    profiles: "[]",
                    search_results: result.businesses,
                    search_total: result.total_ratings
                });
            }
        });
        
        // Convert back to array and sort by degree
        return Array.from(networkMap.values()).sort((a, b) => a.degree - b.degree);
    }, [networkData, searchResults]);

    return (
        <StyledContainer>
            <Backdrop sx={{ color: '#fff', zIndex: 1 }} open={showSpinner}>
                <CircularProgress color="inherit" />
            </Backdrop>
            <Header title="Network" />
            <Box sx={{ width: "100%", padding: "0px 16px 16px 16px" }}>
                <Box sx={{ width: "100%", paddingX: "16px", display: "flex", justifyContent: "space-between" }}>
                    <IconButton onClick={() => navigate("/referral")}>
                        <GroupAddIcon />
                    </IconButton>

                    <IconButton onClick={() => navigate("/recommendation")}>
                        <AddShoppingCartIcon />
                    </IconButton>
                </Box>
                <SearchBar 
                    setSearchString={setSearchString} 
                    handleSearch={handleSearch} 
                />
                {error && <p style={{ color: "red" }}>{error}</p>}

                <Box sx={{ width: "100%", marginTop: "24px" }}>
                    <Box sx={{ display: 'flex', width: '100%' }}>
                        <Box sx={{ width: '33.333%', textAlign: 'center' }}>
                            <TotalLabel>Connections</TotalLabel>
                        </Box>
                        
                        <Box sx={{ width: '33.333%', textAlign: 'center' }}>
                            {/* Center column - intentionally empty */}
                        </Box>
                        
                        <Box sx={{ width: '33.333%', textAlign: 'center' }}>
                            {searchResults && (
                                <TotalLabel>Results for "{searchString}"</TotalLabel>
                            )}
                        </Box>
                    </Box>
                </Box>
                
                <NetworkData 
                    data={combinedData} 
                    hasSearchResults={!!searchResults} 
                    searchString={searchString}
                />
            </Box>
            <NavigationBar />
        </StyledContainer>
    );
}