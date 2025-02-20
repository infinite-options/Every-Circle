import React, { useState, useEffect } from "react";
import { FormControl, Select, MenuItem, Chip, Box, Typography, Button, TextField } from "@mui/material";
import axios from "axios";

const CategorySelector = ({setFormData, formData}) => {
    const [allCategories, setAllCategories] = useState([]);
    const [mainCategories, setMainCategories] = useState([]);
    const [selectedMainCategories, setSelectedMainCategories] = useState([]);
    const [filteredSubCategories, setFilteredSubCategories] = useState([]);
    const [selectedSubCategories, setSelectedSubCategories] = useState([]);
    const [filteredSubSubCategories, setFilteredSubSubCategories] = useState([]);
    const [selectedSubSubCategories, setSelectedSubSubCategories] = useState([]);
    const [customTags, setCustomTags] = useState([]);
    const [newTag, setNewTag] = useState("");

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await axios.get("https://ioEC2testsspm.infiniteoptions.com/category_list/all");
                setAllCategories(response.data.result);
                
                const mainCategories = response.data.result
                    .filter(cat => cat.category_parent_id === null)
                    .map(cat => ({ id: cat.category_uid, name: cat.category_name }));
                
                setMainCategories(mainCategories);
            } catch (error) {
                console.error("Error fetching categories:", error);
            }
        };
        fetchCategories();
    }, []);

    useEffect(() => {
        const subCategories = allCategories.filter(cat => 
            selectedMainCategories.includes(cat.category_parent_id));
        setFilteredSubCategories(subCategories);
        setSelectedSubCategories(selectedSubCategories.filter(cat => subCategories.some(sub => sub.category_uid === cat)));
    }, [selectedMainCategories, allCategories]);

    useEffect(() => {
        const subSubCategories = allCategories.filter(cat => 
            selectedSubCategories.includes(cat.category_parent_id));
        setFilteredSubSubCategories(subSubCategories);
        setSelectedSubSubCategories(selectedSubSubCategories.filter(cat => subSubCategories.some(sub => sub.category_uid === cat)));
    }, [selectedSubCategories, allCategories]);

    const addCustomTag = () => {
        if (newTag.trim() !== "") {
            setCustomTags([...customTags, newTag.trim()]);
            setNewTag("");
        }
    };

    const removeCustomTag = (tagToRemove) => {
        setCustomTags(customTags.filter(tag => tag !== tagToRemove));
    };

    useEffect(() => {
        const selectedIds = [...selectedMainCategories, ...selectedSubCategories, ...selectedSubSubCategories];
        const selectedObjects = selectedIds.map(id => {
            const category = allCategories.find(cat => cat.category_uid === id);
            return category ? { id: category.category_uid, name: category.category_name } : null;
        }).filter(Boolean);
        
        if(setFormData){
            setFormData(prevFormData => ({
                ...prevFormData, // Spread the previous formData
                categories: selectedIds, // Append selected categories
                customTags: customTags, // Append custom tags
            }));
        }
    
        console.log("Selected Categories:", selectedIds);
        console.log("Custom Tags:", customTags);
    }, [selectedMainCategories, selectedSubCategories, selectedSubSubCategories, customTags]);
    

    // const getSelectedCategories = () => {
    //     const selectedIds = [...selectedMainCategories, ...selectedSubCategories, ...selectedSubSubCategories];
    //     const selectedObjects = selectedIds.map(id => {
    //         const category = allCategories.find(cat => cat.category_uid === id);
    //         return category ? { id: category.category_uid, name: category.category_name } : null;
    //     }).filter(Boolean);
    //     console.log("Selected IDs:", selectedIds);
    //     console.log("Selected Categories:", selectedObjects);
    //     console.log("Custom Tags:", customTags);
    // };

    return (
        <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px" }}> Main Categories</Typography>
            <FormControl fullWidth>
                <Select
                    sx={{backgroundColor: "white"}}
                    multiple
                    value={selectedMainCategories}
                    onChange={(e) => setSelectedMainCategories(e.target.value)}
                    renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => (
                                <Chip key={value} label={mainCategories.find(cat => cat.id === value)?.name} onDelete={() => setSelectedMainCategories(selectedMainCategories.filter(cat => cat !== value))} />
                            ))}
                        </Box>
                    )}
                >
                    {mainCategories.map((category) => (
                        <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            {filteredSubCategories.length > 0 && (
                <>
                    <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px" }}>Sub Categories</Typography>
                    <FormControl fullWidth>
                        <Select
                            multiple
                            sx={{backgroundColor: "white"}}
                            value={selectedSubCategories}
                            onChange={(e) => setSelectedSubCategories(e.target.value)}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.map((value) => (
                                        <Chip key={value} label={filteredSubCategories.find(cat => cat.category_uid === value)?.category_name} onDelete={() => setSelectedSubCategories(selectedSubCategories.filter(cat => cat !== value))} />
                                    ))}
                                </Box>
                            )}
                        >
                            {filteredSubCategories.map((category) => (
                                <MenuItem key={category.category_uid} value={category.category_uid}>{category.category_name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </>
            )}

            {filteredSubSubCategories.length > 0 && (
                <>
                    <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px" }}>Sub-Sub Categories</Typography>
                    <FormControl fullWidth>
                        <Select
                            multiple
                            sx={{backgroundColor: "white"}}
                            value={selectedSubSubCategories}
                            onChange={(e) => setSelectedSubSubCategories(e.target.value)}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.map((value) => (
                                        <Chip key={value} label={filteredSubSubCategories.find(cat => cat.category_uid === value)?.category_name} onDelete={() => setSelectedSubSubCategories(selectedSubSubCategories.filter(cat => cat !== value))} />
                                    ))}
                                </Box>
                            )}
                        >
                            {filteredSubSubCategories.map((category) => (
                                <MenuItem key={category.category_uid} value={category.category_uid}>{category.category_name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </>
            )}

            <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px" }}>Custom Tags</Typography>
            <TextField 
                sx={{backgroundColor: "white"}} 
                value={newTag} 
                onChange={(e) => setNewTag(e.target.value)} 
                placeholder="Add custom tag" 
                fullWidth 
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        addCustomTag(); 
                        e.preventDefault(); 
                    }
                }} 
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {customTags.map((tag, index) => (
                    <Chip key={index} label={tag} sx={{backgroundColor: "#ebebeb"}} onDelete={() => removeCustomTag(tag)} />
                ))}
            </Box>
        </Box>
    );
};

export default CategorySelector;