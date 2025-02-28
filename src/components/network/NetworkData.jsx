// import React, { useState } from "react";
// import { Box, Typography, List, ListItem, ListItemText, Collapse, Grid} from "@mui/material";
// import { DataGrid } from "@mui/x-data-grid";
// import { useNavigate } from "react-router-dom";

// export default function NetworkData({ data }) {
//   // const [nbRows, setNbRows] = React.useState(3);
//   // const removeRow = () => setNbRows((x) => Math.max(0, x - 1));
//   // const addRow = () => setNbRows((x) => Math.min(100, x + 1));

//   const degreeLabels = {
//     0: "You",
//     1: "Direct",
//     2: "1-Away",
//     3: "2-Away"
//   };

//   const [openIndex, setOpenIndex] = useState(null);
//   const navigate = useNavigate();

//   const handleToggle = (index) => {
//     setOpenIndex(openIndex === index ? null : index);
//   };

//   return (
//     <Box sx={{ width: "100%", minHeight: "300px", marginTop: "16px" }}>
//       {data?.length > 0 ? (
//         <List>
//           {data.map((item, index) => (
//             <Box key={index}>
//               <ListItem button onClick={() => handleToggle(index)} sx={{ cursor: "pointer" }}>
//                 <Grid container alignItems="center" textAlign="center">
//                   <Grid item xs={6}>
//                     <Box
//                       sx={{
//                         width: 60,
//                         height: 60,
//                         borderRadius: "50%",
//                         backgroundColor: "#ff9500",
//                         color: "#fff",
//                         display: "flex",
//                         alignItems: "center",
//                         justifyContent: "center",
//                         margin: "auto",
//                         fontSize: 12,
//                         fontWeight: 500,
//                       }}
//                     >
//                       {degreeLabels[item.degree] || "Unknown"}
//                     </Box>
//                   </Grid>
//                   <Grid item xs={6}>
//                     <Typography>{item.connection_count}</Typography>
//                   </Grid>
//                 </Grid>
//               </ListItem>
//               <Collapse in={openIndex === index} timeout="auto" unmountOnExit>
//                 <Box sx={{ backgroundColor: "#f5f5f5", padding: 2 }}>
//                   <Typography variant="subtitle1" sx={{ fontWeight: "bold", marginBottom: 1, textAlign: "center" }}>
//                     Users
//                   </Typography>
//                   <List component="div" disablePadding>
//                     {JSON.parse(item.profiles).map((user) => (
//                       <ListItem 
//                         key={user.user_id} 
//                         sx={{ textAlign: "center", cursor: "pointer" }}
//                         onClick={() => {
//                           navigate("/showTemplate", {
//                             state: {
//                               profileId: user.user_id,
//                               navigatingFrom: "networkPage",
//                             },
//                           });
//                         }}
//                       >
//                         <ListItemText primary={user.first_name + " " + user.last_name + " " + "(" + user.user_id + ")"} />
//                       </ListItem>
//                     ))}
//                   </List>
//                 </Box>
//               </Collapse>
//             </Box>
//           ))}
//         </List>
//       ) : (
//         <Box
//           sx={{
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             width: "100%",
//           }}
//         >
//           No Network
//         </Box>
//       )}
//     </Box>
//   );
// }

import React, { useState, useEffect } from "react";
import { Box, Typography, List, ListItem, ListItemText, Collapse, Grid, Divider, Rating, IconButton } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

export default function NetworkData({ data, hasSearchResults, searchString }) {
  const degreeLabels = {
    0: "You",
    1: "Direct",
    2: "1-Away",
    3: "2-Away"
  };

  const [openIndex, setOpenIndex] = useState(null);
  const [openUserIndices, setOpenUserIndices] = useState({});
  const navigate = useNavigate();

  const handleToggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
    // Reset open user rows when closing a degree section
    if (openIndex === index) {
      setOpenUserIndices({});
    }
  };

  const handleUserToggle = (degreeIndex, userId) => {
    const key = `${degreeIndex}-${userId}`;
    setOpenUserIndices(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Function to count ratings by a specific profile ID
  const countRatingsByProfileId = (profileId, searchResults) => {
    if (!searchResults || !Array.isArray(searchResults)) return 0;
    
    return searchResults.filter(result => result.rating_profile_id === profileId).length;
  };

  // Function to get ratings by a specific profile ID
  const getRatingsByProfileId = (profileId, searchResults) => {
    if (!searchResults || !Array.isArray(searchResults)) return [];
    
    return searchResults.filter(result => result.rating_profile_id === profileId);
  };

  return (
    <Box sx={{ width: "100%", minHeight: "300px", marginTop: "16px" }}>
      {data?.length > 0 ? (
        <List>
          {data.map((item, index) => (
            <Box key={index}>
              <ListItem 
                button 
                onClick={() => handleToggle(index)} 
                sx={{ 
                  cursor: "pointer",
                  backgroundColor: hasSearchResults ? "#f9f9f9" : "transparent",
                  py: 1.5
                }}
              >
                <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                  {/* Left: Connection Count */}
                  <Box sx={{ width: '33.333%', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '1.125rem' }}>
                      {item.connection_count}
                    </Typography>
                  </Box>
                  
                  {/* Center: Degree Label */}
                  <Box sx={{ width: '33.333%', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        backgroundColor: "#ff9500",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {degreeLabels[item.degree] || "Unknown"}
                    </Box>
                  </Box>
                  
                  {/* Right: Search Results Count */}
                  <Box sx={{ width: '33.333%', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                    {hasSearchResults && (
                      <Typography sx={{ fontWeight: 'bold', fontSize: '1.125rem' }}>
                        {item.search_total || 0}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </ListItem>
              
              <Collapse in={openIndex === index} timeout="auto" unmountOnExit>
                <Box sx={{ backgroundColor: "#f5f5f5", padding: 2 }}>
                  {item.profiles && JSON.parse(item.profiles).length > 0 ? (
                    <List component="div" disablePadding sx={{ px: 2 }}>
                      {JSON.parse(item.profiles).map((user, userIndex) => {
                        // Count ratings for this user
                        const userRatingsCount = hasSearchResults ? 
                          countRatingsByProfileId(user.user_id, item.search_results) : 0;
                          
                        // Get the specific ratings for this user
                        const userRatings = hasSearchResults ? 
                          getRatingsByProfileId(user.user_id, item.search_results) : [];
                          
                        // Generate a unique key for this user within this degree
                        const userKey = `${index}-${user.user_id}`;
                        const isUserOpen = !!openUserIndices[userKey];
                        
                        // Check if this is the last user and if there are other results
                        const isLastUser = userIndex === JSON.parse(item.profiles).length - 1;
                        const hasOtherResults = hasSearchResults && 
                          item.search_results && 
                          item.search_results.some(result => !result.rating_profile_id);
                        
                        return (
                          <Box key={user.user_id} sx={{ width: '100%' }}>
                            <ListItem 
                              sx={{ 
                                // Remove bottom border if this is the last user and Other Results follow
                                borderBottom: (isUserOpen || (isLastUser && hasOtherResults)) 
                                  ? "none" 
                                  : "1px solid #eaeaea",
                                py: 1.5,
                                cursor: "pointer",
                                borderRadius: "4px",
                                "&:hover": {
                                  backgroundColor: "#f0f0f0"
                                }
                              }}
                              onClick={() => hasSearchResults && userRatingsCount > 0 ? 
                                handleUserToggle(index, user.user_id) : 
                                navigate("/showTemplate", {
                                  state: {
                                    profileId: user.user_id,
                                    navigatingFrom: "networkPage",
                                  },
                                })
                              }
                            >
                              <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                                {/* Left column with name aligned with the connection count */}
                                <Box sx={{ width: '33.333%', textAlign: 'left', pl: 4 }}>
                                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                    {user.first_name} {user.last_name}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    ({user.user_id})
                                  </Typography>
                                </Box>
                                
                                {/* Middle column - empty for spacing */}
                                <Box sx={{ width: '33.333%', textAlign: 'center' }}>
                                  {/* Intentionally empty for alignment */}
                                </Box>
                                
                                {/* Right column showing ratings count directly under total */}
                                <Box sx={{ width: '33.333%', display: 'flex', justifyContent: 'flex-end', pr: 4 }}>
                                  {hasSearchResults && (
                                    <>
                                      {/* Show count (or 0) for all users */}
                                      <Typography variant="body1" sx={{ fontWeight: "bold", mr: userRatingsCount > 0 ? 2.5 : 5 }}>
                                        {userRatingsCount}
                                      </Typography>
                                      
                                      {/* Only show icon if there are ratings to expand */}
                                      {userRatingsCount > 0 && (
                                        isUserOpen ? 
                                          <ExpandLessIcon fontSize="small" /> : 
                                          <ExpandMoreIcon fontSize="small" />
                                      )}
                                    </>
                                  )}
                                </Box>
                              </Box>
                            </ListItem>
                            
                            {/* User's ratings collapse section */}
                            {hasSearchResults && userRatingsCount > 0 && (
                              <Collapse in={isUserOpen} timeout="auto" unmountOnExit>
                                <Box sx={{ 
                                  backgroundColor: "#eaeaea", 
                                  padding: 2, 
                                  ml: 0,
                                  mb: 1,
                                  borderRadius: 1,
                                  width: '100%'
                                }}>
                                  <Typography variant="subtitle2" sx={{ mb: 1, textAlign: 'center' }}>
                                    Ratings for "{searchString}"
                                  </Typography>
                                  <List disablePadding>
                                    {userRatings.map((rating, ratingIndex) => (
                                      <ListItem 
                                        key={ratingIndex} 
                                        sx={{ 
                                          flexDirection: "column", 
                                          alignItems: "flex-start",
                                          borderBottom: ratingIndex < userRatings.length - 1 ? "1px solid #ddd" : "none",
                                          py: 1
                                        }}
                                        onClick={() => {
                                          navigate("/showTemplate", {
                                            state: {
                                              profileId: rating.rating_business_id || rating.business_uid,
                                              navigatingFrom: "networkSearch",
                                              searchString: searchString
                                            },
                                          });
                                        }}
                                      >
                                        <Grid container alignItems="center">
                                          <Grid item xs={8}>
                                            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                                              {rating.business_name}
                                            </Typography>
                                            
                                            {rating.rating_description && (
                                              <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.875rem" }}>
                                                "{rating.rating_description}"
                                              </Typography>
                                            )}
                                          </Grid>
                                          
                                          <Grid item xs={4} sx={{ textAlign: 'center' }}>
                                            <Rating 
                                              value={rating.rating_star || parseFloat(rating.business_google_rating) || 0} 
                                              readOnly 
                                              size="small" 
                                            />
                                            
                                            {rating.rating_updated_at_timestamp && (
                                              <Typography variant="caption" sx={{ display: 'block', color: "text.secondary", mt: 0.5 }}>
                                                {new Date(rating.rating_updated_at_timestamp).toLocaleDateString()}
                                              </Typography>
                                            )}
                                          </Grid>
                                        </Grid>
                                      </ListItem>
                                    ))}
                                  </List>
                                </Box>
                              </Collapse>
                            )}
                            
                            {/* Add bottom border if user section is expanded */}
                            {isUserOpen && (
                              <Divider sx={{ mb: 1 }} />
                            )}
                          </Box>
                        );
                      })}
                    </List>
                  ) : (
                    <Typography align="center" sx={{ py: 2 }}>
                      No connections at this level
                    </Typography>
                  )}
                  
                  {/* If there are search results but no profiles attached to them */}
                  {hasSearchResults && item.search_results && item.search_results.length > 0 && 
                   item.search_results.some(result => !result.rating_profile_id) && (
                    <Box sx={{ mt: 2 }}>
                      <Divider sx={{ mb: 1 }} />
                      <Typography variant="subtitle2" sx={{ textAlign: "center", mb: 1 }}>
                        Other Results
                      </Typography>
                      <List component="div" disablePadding>
                        {item.search_results
                          .filter(result => !result.rating_profile_id)
                          .map((result) => (
                            <ListItem 
                              key={result.business_uid} 
                              sx={{ 
                                borderBottom: "1px solid #eaeaea",
                                py: 1,
                                cursor: "pointer"
                              }}
                              onClick={() => {
                                navigate("/showTemplate", {
                                  state: {
                                    profileId: result.business_uid,
                                    navigatingFrom: "networkSearch",
                                    searchString: searchString
                                  },
                                });
                              }}
                            >
                              <Typography variant="body1">
                                {result.business_name}
                              </Typography>
                            </ListItem>
                          ))
                        }
                      </List>
                    </Box>
                  )}
                  
                  {/* If user clicked on a row with no connections or results */}
                  {(!item.profiles || JSON.parse(item.profiles).length === 0) && 
                   (!hasSearchResults || !item.search_results || item.search_results.length === 0) && (
                    <Typography align="center" sx={{ py: 2 }}>
                      No data to display
                    </Typography>
                  )}
                </Box>
              </Collapse>
            </Box>
          ))}
        </List>
      ) : (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
          }}
        >
          No Network
        </Box>
      )}
    </Box>
  );
}