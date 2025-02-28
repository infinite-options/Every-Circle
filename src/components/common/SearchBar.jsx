import React, { useState } from "react"; 
import { Box, TextField, InputAdornment, IconButton, Dialog, DialogTitle, DialogContent, Typography, Button } from "@mui/material"; 
import SearchIcon from "@mui/icons-material/Search"; 
import ChatIcon from "@mui/icons-material/Chat"; 
import CloseIcon from "@mui/icons-material/Close"; 
import FilterButton from '../search/FilterButton'; //new  

export default function SearchBar({ setSearchString = () => {}, handleSearch = () => {} }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "How can I assist you today?", options: ["Order Status", "Support", "Pricing"] },
  ]);
  
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && handleSearch) {
      handleSearch();
    }
  };
  
  const handleOptionClick = (option) => {
    setMessages([...messages, { text: option, isUser: true }]);
    // Simulate AI response (modify this for backend integration)
    setTimeout(() => {
      setMessages((prev) => [...prev, { text: `You selected: ${option}`, options: ["Back", "Main Menu"] }]);
    }, 500);
  };
  
  return (
    <Box sx={{ width: "100%" }}>
      <TextField
        fullWidth
        label="Search..."
        onChange={(e) => setSearchString(e.target.value)}
        onKeyDown={handleKeyDown}
        sx={{
          '& input:focus': {
            outline: 'none !important',
            border: 'none !important', // Ensure no border on focus
            boxShadow: 'none !important',
          },
        }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              {/* Search Icon */}
              <IconButton onClick={handleSearch}>
                <SearchIcon />
              </IconButton>
              {/* Filter Button */}
              <FilterButton />
              {/* Chatbot Icon */}
              <IconButton onClick={() => setChatOpen(true)}>
                <ChatIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      
      {/* Chatbot Popup */}
      <Dialog open={chatOpen} onClose={() => setChatOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Chatbot
          <IconButton onClick={() => setChatOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {messages.map((msg, index) => (
            <Box key={index} sx={{ my: 1, width: "100%", display: "flex", flexDirection:"column", alignItems: msg.isUser ? "end" : "start"}}>
                <Typography
                sx={{
                    display: "block",
                    padding: "8px 12px",
                    borderRadius: "18px",
                    backgroundColor: msg.isUser ? "primary.light" : "grey.300",
                }}
                >
                {msg.text}
                </Typography>
                {msg.options &&
                msg.options.map((option, idx) => (
                    <Button key={idx} variant="outlined" size="small" sx={{ m: 0.5 }} onClick={() => handleOptionClick(option)}>
                    {option}
                    </Button>
                ))}
            </Box>
            ))}
        </DialogContent>
      </Dialog>
    </Box>
  );
}