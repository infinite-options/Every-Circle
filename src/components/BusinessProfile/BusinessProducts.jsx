// closed eye
import eyeIcon from "../../assets/eye.png";
import closedEyeIcon from "../../assets/closedEye.png";

import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, styled, IconButton, 
  TextField, Divider
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import moneyBag from "../../assets/moneybag.png";

const SectionTitle = styled(Typography)({
  fontWeight: 600,
  marginBottom: '16px',
  borderBottom: '1px solid #e0e0e0',
  paddingBottom: '8px'
});

const ProductCard = styled(Box)({
  position: 'relative',
  marginBottom: '16px',
  padding: '16px',
  backgroundColor: '#f5f5f5',
  borderRadius: '8px'
});

function BusinessProducts({ editMode, businessId, products = [], onProductsChange, publicFieldValue, onPublicToggle, PublicLabelComponent }) {
  
    console.log("In businessProducts:", products)

  // Initialize with default empty products if none are provided
  useEffect(() => {
    if (products.length === 0 && editMode) {
      // Add two default empty product entries
      onProductsChange([
        { bs_service_name: "", bs_cost: "", bs_bounty: "", bs_service_desc: "", bs_is_visible: 1 },
        { bs_service_name: "", bs_cost: "", bs_bounty: "", bs_service_desc: "", bs_is_visible: 1 }
      ]);
    }
  }, [editMode]);

  // Debugging - Log what's received
  useEffect(() => {
    console.log("BusinessProducts received:", products);
  }, [products]);

  const handleAddProduct = () => {
    const newProduct = {
      bs_service_name: "",
      bs_cost: "",
      bs_bounty: "",
      bs_service_desc: "",
      bs_is_visible: 1
    };
    onProductsChange([...products, newProduct]);
  };

  const handleDeleteProduct = (index) => {
    const updatedProducts = [...products];
    updatedProducts.splice(index, 1);
    onProductsChange(updatedProducts);
  };

  const handleProductChange = (index, field, value) => {
    console.log(`Before update - Product at index ${index}:`, products[index]);
    console.log(`Changing ${field} from ${products[index][field]} to ${value}`);
    
    const updatedProducts = [...products];
    updatedProducts[index] = {
      ...updatedProducts[index],
      [field]: value
    };
    
    console.log(`After update - Updated product:`, updatedProducts[index]);
    
    onProductsChange(updatedProducts);
  };

  // Display products or a message if no products and not in edit mode
  const displayProducts = products.length > 0 || editMode;

  return (
    <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionTitle variant="h6">
                Products
            </SectionTitle>
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {/* Public/Private toggle on the right */}
                <Typography
                    onClick={editMode ? onPublicToggle : undefined}
                    sx={{
                        color: '#666',
                        fontSize: '14px',
                        cursor: editMode ? 'pointer' : 'default',
                        textTransform: 'none',
                        marginRight: '16px',
                        '&:hover': {
                            opacity: editMode ? 0.8 : 1
                        }
                    }}
                >
                    {publicFieldValue === 1 ? 'Public' : 'Private'}
                </Typography>
                
                {/* Add button */}
                {editMode && (
                    <IconButton 
                        color="primary" 
                        onClick={handleAddProduct}
                    >
                        <AddIcon />
                    </IconButton>
                )}
            </Box>
        </Box>

      {!displayProducts ? (
        <Typography color="text.secondary" align="center" sx={{ my: 2 }}>
          No products or services listed
        </Typography>
      ) : (
        products.map((product, index) => (
          <ProductCard key={index}>
            {editMode && products.length > 1 && (
              <IconButton 
                size="small" 
                onClick={() => handleDeleteProduct(index)}
                sx={{ position: 'absolute', right: 8, top: 8 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
            
            <TextField
              fullWidth
              label="Product/Service Name"
              value={product.bs_service_name || ""}
              onChange={(e) => handleProductChange(index, "bs_service_name", e.target.value)}
              disabled={!editMode}
              sx={{ 
                mb: 2,
                backgroundColor: editMode ? 'white' : '#e0e0e0',
              }}
            />
            
            <TextField
              fullWidth
              label="Product Description"
              value={product.bs_service_desc || ""}
              onChange={(e) => handleProductChange(index, "bs_service_desc", e.target.value)}
              disabled={!editMode}
              multiline
              rows={2}
              sx={{ 
                mb: 2,
                backgroundColor: editMode ? 'white' : '#e0e0e0',
              }}
            />
            
            {/* Row with Cost, Bounty, Eye icon, and Trash */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Cost field */}
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Cost ($)"
                  value={product.bs_cost || ""}
                  onChange={(e) => handleProductChange(index, "bs_cost", e.target.value)}
                  disabled={!editMode}
                  type="number"
                  inputProps={{ min: "0", step: "0.01" }}
                  sx={{ 
                    backgroundColor: editMode ? 'white' : '#e0e0e0',
                  }}
                />
              </Box>
              
              {/* Money bag icon */}
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <img 
                  src={moneyBag} 
                  alt="Bounty" 
                  style={{ width: '24px', height: '24px' }} 
                />
              </Box>
              
              {/* Bounty field */}
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Bounty ($)"
                  value={product.bs_bounty || ""}
                  onChange={(e) => handleProductChange(index, "bs_bounty", e.target.value)}
                  disabled={!editMode}
                  type="number"
                  inputProps={{ min: "0", step: "0.01" }}
                  sx={{ 
                    backgroundColor: editMode ? 'white' : '#e0e0e0',
                  }}
                />
              </Box>
              
              {/* Eye icon */}
              {/* <Box 
  onClick={() => {
    if (editMode) {
      // Force the value to be a number
      const currentValue = parseInt(product.bs_is_visible || 0, 10);
      // Toggle between 0 and 1
      const newValue = currentValue === 1 ? 0 : 1;
      console.log(`Changing bs_is_visible from ${currentValue} to ${newValue}`);
      handleProductChange(index, "bs_is_visible", newValue);
    }
  }}
  sx={{ 
    cursor: editMode ? 'pointer' : 'default',
    opacity: parseInt(product.bs_is_visible || 0, 10) === 1 ? 1 : 0.3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ml: 1,
    padding: '4px',
    border: parseInt(product.bs_is_visible || 0, 10) === 1 ? 'none' : '1px solid #ddd',
    borderRadius: '50%',
  }}
>
                <img 
                  src={eyeIcon} 
                  alt="Visibility" 
                  style={{ 
                    width: '24px', 
                    height: '24px',
                  }}
                />
              </Box> */}

              {/* Eye icon */}
<Box 
  onClick={() => {
    if (editMode) {
      // Force the value to be a number
      const currentValue = parseInt(product.bs_is_visible || 0, 10);
      // Toggle between 0 and 1
      const newValue = currentValue === 1 ? 0 : 1;
      console.log(`Changing bs_is_visible from ${currentValue} to ${newValue}`);
      handleProductChange(index, "bs_is_visible", newValue);
    }
  }}
  sx={{ 
    cursor: editMode ? 'pointer' : 'default',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ml: 1,
    padding: '4px',
  }}
>
  <img 
    src={parseInt(product.bs_is_visible || 0, 10) === 1 ? eyeIcon : closedEyeIcon} 
    alt={parseInt(product.bs_is_visible || 0, 10) === 1 ? "Visible" : "Hidden"} 
    style={{ 
      width: '24px', 
      height: '24px',
    }}
  />
</Box>
              
              {/* Trash icon (only in edit mode) */}
              {editMode && (
                <IconButton 
                  size="small" 
                  onClick={() => handleDeleteProduct(index)}
                  sx={{ ml: 1 }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            
            {!editMode && product.bs_service_name && (
              <Box sx={{ mt: 2 }}>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                  <Typography variant="body1" fontWeight="bold">
                    Price: ${parseFloat(product.bs_cost || "0").toFixed(2)}
                  </Typography>
                  <Typography variant="body1" color="primary" fontWeight="bold">
                    Bounty: ${parseFloat(product.bs_bounty || "0").toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            )}
          </ProductCard>
        ))
      )}
    </Box>
  );
}

export default BusinessProducts;