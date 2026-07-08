import React, { useState, useCallback } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { loadAllCartItems } from "../utils/shoppingCartStorage";

export function HeaderCartButton({ cartCount, onPress }) {
  return (
    <TouchableOpacity style={styles.cartButton} onPress={onPress} accessibilityRole='button' accessibilityLabel='Shopping cart'>
      <Ionicons name='cart-outline' size={24} color='#fff' />
      {cartCount > 0 ? (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{cartCount}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/** Header cart icon + count; refreshes when the screen gains focus. */
export function useHeaderCart(navigation, { returnTo, searchState } = {}) {
  const [cartCount, setCartCount] = useState(0);
  const [cartItems, setCartItems] = useState([]);

  const refreshCart = useCallback(async () => {
    try {
      const loaded = await loadAllCartItems();
      setCartCount(loaded.cartCount);
      setCartItems(loaded.cartItems);
    } catch (error) {
      console.error("useHeaderCart - failed to load cart:", error);
      setCartCount(0);
      setCartItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshCart();
    }, [refreshCart]),
  );

  const openCart = useCallback(() => {
    navigation.navigate("ShoppingCart", {
      cartItems,
      businessName: "All Items",
      business_uid: "all",
      ...(returnTo ? { returnTo } : {}),
      ...(searchState ? { searchState } : {}),
    });
  }, [navigation, cartItems, returnTo, searchState]);

  const headerCartButton = <HeaderCartButton cartCount={cartCount} onPress={openCart} />;

  return { cartCount, cartItems, refreshCart, headerCartButton };
}

const styles = StyleSheet.create({
  cartButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
    minWidth: 40,
    minHeight: 40,
  },
  cartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
});
