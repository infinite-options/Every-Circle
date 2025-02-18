import React, { useState } from "react";
import { Box, Typography, List, ListItem, ListItemText, Collapse, Grid} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";

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

  const [openIndex, setOpenIndex] = useState(null);
  const navigate = useNavigate();

  const handleToggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <Box sx={{ width: "100%", minHeight: "300px", marginTop: "16px" }}>
      {data?.length > 0 ? (
        <List>
          {data.map((item, index) => (
            <Box key={index}>
              <ListItem button onClick={() => handleToggle(index)} sx={{ cursor: "pointer" }}>
                <Grid container alignItems="center" textAlign="center">
                  <Grid item xs={6}>
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
                        margin: "auto",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {degreeLabels[item.degree] || "Unknown"}
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography>{item.connection_count}</Typography>
                  </Grid>
                </Grid>
              </ListItem>
              <Collapse in={openIndex === index} timeout="auto" unmountOnExit>
                <Box sx={{ backgroundColor: "#f5f5f5", padding: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: "bold", marginBottom: 1, textAlign: "center" }}>
                    Users
                  </Typography>
                  <List component="div" disablePadding>
                    {JSON.parse(item.profile_id).map((id) => (
                      <ListItem 
                        key={id} 
                        sx={{ textAlign: "center", cursor: "pointer" }}
                        onClick={() => {
                          navigate("/showTemplate", {
                            state: {
                              profileId: id,
                              navigatingFrom: "networkPage",
                            },
                          });
                        }}
                      >
                        <ListItemText primary={id} />
                      </ListItem>
                    ))}
                  </List>
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
