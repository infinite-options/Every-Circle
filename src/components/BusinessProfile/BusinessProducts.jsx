
/////fwifh edw
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

function BusinessProducts({ editMode, businessId, products = [], onProductsChange }) {
  // Initialize with default empty products if none are provided
  useEffect(() => {
    if (products.length === 0 && editMode) {
      // Add two default empty product entries
      onProductsChange([
        { bs_service_name: "", bs_cost: "", bs_bounty: "50.00" },
        { bs_service_name: "", bs_cost: "", bs_bounty: "50.00" }
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
      bs_bounty: "50.00"
    };
    onProductsChange([...products, newProduct]);
  };

  const handleDeleteProduct = (index) => {
    const updatedProducts = [...products];
    updatedProducts.splice(index, 1);
    onProductsChange(updatedProducts);
  };

  const handleProductChange = (index, field, value) => {
    const updatedProducts = [...products];
    updatedProducts[index] = {
      ...updatedProducts[index],
      [field]: value
    };
    
    // Add debug logging
    console.log(`Updated field ${field} to ${value} for product at index ${index}`);
    console.log("Updated product:", updatedProducts[index]);
    
    onProductsChange(updatedProducts);
  };

  // Display products or a message if no products and not in edit mode
  const displayProducts = products.length > 0 || editMode;

  return (
    <Box sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle variant="h6">
          Products & Services
        </SectionTitle>
        {editMode && (
          <IconButton 
            color="primary" 
            onClick={handleAddProduct}
          >
            <AddIcon />
          </IconButton>
        )}
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
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
              
              <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <img 
                  src={moneyBag} 
                  alt="Bounty" 
                  style={{ width: '24px', height: '24px', marginRight: '8px' }} 
                />
                <TextField
                  fullWidth
                  label="Bounty ($)"
                  value={product.bs_bounty || "50.00"}
                  onChange={(e) => handleProductChange(index, "bs_bounty", e.target.value)}
                  disabled={!editMode}
                  type="number"
                  inputProps={{ min: "0", step: "0.01" }}
                  sx={{ 
                    backgroundColor: editMode ? 'white' : '#e0e0e0',
                  }}
                />
              </Box>
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